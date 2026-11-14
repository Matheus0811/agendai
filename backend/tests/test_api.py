"""Testes de ponta a ponta da API: cadastro, catálogo, agendamento e cancelamento."""
from datetime import date, timedelta


def next_weekday(weekday: int, min_days: int = 2) -> date:
    """Próxima data com o dia da semana pedido (0 = segunda), a pelo menos `min_days` de hoje."""
    day = date.today() + timedelta(days=min_days)
    while day.weekday() != weekday:
        day += timedelta(days=1)
    return day


def register(client, email="dono@teste.com", business="Barbearia Teste"):
    response = client.post(
        "/api/auth/register",
        json={"name": "Dono Teste", "email": email, "password": "segredo123", "business_name": business},
    )
    assert response.status_code == 201, response.text
    data = response.json()
    return {"Authorization": f"Bearer {data['access_token']}"}, data["user"]["business"]


def create_service(client, headers, name="Corte", duration=60, price=5000):
    response = client.post(
        "/api/services",
        headers=headers,
        json={"name": name, "duration_minutes": duration, "price_cents": price},
    )
    assert response.status_code == 201, response.text
    return response.json()


def test_health(client):
    assert client.get("/api/health").json() == {"status": "ok"}


def test_cadastro_login_e_me(client):
    _, business = register(client)
    assert business["slug"] == "barbearia-teste"

    login = client.post("/api/auth/login", json={"email": "dono@teste.com", "password": "segredo123"})
    assert login.status_code == 200
    token = login.json()["access_token"]

    me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.json()["email"] == "dono@teste.com"


def test_login_com_senha_errada(client):
    register(client)
    response = client.post("/api/auth/login", json={"email": "dono@teste.com", "password": "errada"})
    assert response.status_code == 401


def test_email_duplicado(client):
    register(client)
    response = client.post(
        "/api/auth/register",
        json={"name": "Outro", "email": "dono@teste.com", "password": "segredo123", "business_name": "X Y"},
    )
    assert response.status_code == 409


def test_rotas_protegidas_exigem_login(client):
    assert client.get("/api/services").status_code == 401


def test_um_negocio_nao_ve_dados_do_outro(client):
    headers_a, _ = register(client, "a@teste.com", "Negocio A")
    headers_b, _ = register(client, "b@teste.com", "Negocio B")
    service = create_service(client, headers_a)

    response = client.put(
        f"/api/services/{service['id']}",
        headers=headers_b,
        json={"name": "Hack", "duration_minutes": 30, "price_cents": 1},
    )
    assert response.status_code == 404


def test_fluxo_completo_de_agendamento(client):
    headers, business = register(client)
    service = create_service(client, headers, duration=60)
    slug = business["slug"]
    monday = next_weekday(0).isoformat()

    public = client.get(f"/api/public/business/{slug}").json()
    assert public["services"][0]["name"] == "Corte"
    assert public["professionals"][0]["service_ids"] == [service["id"]]

    times = client.get(
        f"/api/public/business/{slug}/availability", params={"service_id": service["id"], "date": monday}
    ).json()["times"]
    assert "09:00" in times
    assert "11:30" not in times  # serviço de 1h às 11:30 invadiria o almoço (12h)
    assert "12:00" not in times

    booking = {
        "service_id": service["id"],
        "date": monday,
        "time": "09:00",
        "customer_name": "Maria Cliente",
        "customer_phone": "(11) 98888-7777",
    }
    created = client.post(f"/api/public/business/{slug}/appointments", json=booking)
    assert created.status_code == 201, created.text
    code = created.json()["code"]
    assert created.json()["can_cancel"] is True

    # O horário some da lista e não pode ser agendado de novo
    times = client.get(
        f"/api/public/business/{slug}/availability", params={"service_id": service["id"], "date": monday}
    ).json()["times"]
    assert "09:00" not in times and "09:30" not in times
    assert client.post(f"/api/public/business/{slug}/appointments", json=booking).status_code == 409

    # O dono vê o agendamento e o cliente
    agenda = client.get("/api/appointments", headers=headers, params={"start": monday}).json()
    assert len(agenda) == 1 and agenda[0]["customer_phone"] == "11988887777"
    customers = client.get("/api/customers", headers=headers).json()
    assert customers[0]["name"] == "Maria Cliente"
    assert client.get("/api/dashboard", headers=headers).status_code == 200

    # O cliente cancela pelo código e o horário volta a ficar livre
    cancelled = client.post(f"/api/public/appointments/{code}/cancel")
    assert cancelled.json()["status"] == "cancelled"
    times = client.get(
        f"/api/public/business/{slug}/availability", params={"service_id": service["id"], "date": monday}
    ).json()["times"]
    assert "09:00" in times


def test_domingo_fechado_por_padrao(client):
    headers, business = register(client)
    service = create_service(client, headers)
    sunday = next_weekday(6).isoformat()
    response = client.get(
        f"/api/public/business/{business['slug']}/availability",
        params={"service_id": service["id"], "date": sunday},
    )
    assert response.json()["times"] == []


def test_bloqueio_remove_horarios(client):
    headers, business = register(client)
    service = create_service(client, headers, duration=30)
    tuesday = next_weekday(1)
    response = client.post(
        "/api/time-off",
        headers=headers,
        json={"start_at": f"{tuesday}T00:00:00", "end_at": f"{tuesday}T23:59:00", "reason": "Feriado"},
    )
    assert response.status_code == 201
    times = client.get(
        f"/api/public/business/{business['slug']}/availability",
        params={"service_id": service["id"], "date": tuesday.isoformat()},
    ).json()["times"]
    assert times == []


def test_nao_exclui_servico_com_agendamentos(client):
    headers, business = register(client)
    service = create_service(client, headers)
    client.post(
        f"/api/public/business/{business['slug']}/appointments",
        json={
            "service_id": service["id"],
            "date": next_weekday(2).isoformat(),
            "time": "10:00",
            "customer_name": "Ana",
            "customer_phone": "11999990000",
        },
    )
    assert client.delete(f"/api/services/{service['id']}", headers=headers).status_code == 409
