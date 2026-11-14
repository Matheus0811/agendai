"""Popula o banco com um negócio de demonstração.

Uso:  python -m app.seed
Login da demo:  demo@agendai.com / demo123
Página pública: http://localhost:5173/b/navalha-de-ouro
"""
import random
from datetime import datetime, time, timedelta

from sqlalchemy import select

from app.database import Base, SessionLocal, engine
from app.models import Appointment, Business, Professional, Service, TimeOff, User
from app.security import hash_password
from app.services.availability import compute_slots
from app.services.booking import CODE_ALPHABET, business_now, day_hours
from app.utils import default_hours

DEMO_EMAIL = "demo@agendai.com"
DEMO_PASSWORD = "demo123"

SERVICES = [
    ("Corte masculino", "Corte na tesoura ou máquina, com lavagem e finalização.", 45, 4500),
    ("Barba completa", "Toalha quente, navalha e hidratação da barba.", 30, 3500),
    ("Corte + Barba", "O combo completo para sair renovado.", 75, 7000),
    ("Degradê navalhado", "Fade com acabamento na navalha.", 50, 5000),
    ("Sobrancelha", "Design e limpeza com navalha.", 15, 1500),
    ("Pigmentação de barba", "Preenchimento de falhas com pigmento.", 40, 4000),
    ("Hidratação capilar", "Tratamento para cabelo e couro cabeludo.", 30, 4000),
]

PROFESSIONALS = [
    ("Rafael Souza", "Barbeiro sênior", "#6D5AE6", [0, 1, 2, 3, 4, 5]),
    ("Lucas Almeida", "Barbeiro", "#E6735A", [0, 1, 2, 4, 6]),
    ("Bruno Costa", "Barbeiro e colorista", "#2BA87E", [0, 2, 3, 5, 6]),
]

FIRST_NAMES = [
    "João", "Pedro", "Gabriel", "Matheus", "Lucas", "Guilherme", "Felipe", "Gustavo", "Rafael", "Daniel",
    "Bruno", "Thiago", "Vinícius", "Leonardo", "Eduardo", "Rodrigo", "André", "Caio", "Diego", "Henrique",
    "Igor", "Murilo", "Otávio", "Samuel", "Vitor", "Renan", "Arthur", "Enzo", "Davi", "Heitor",
]
LAST_NAMES = ["Silva", "Santos", "Oliveira", "Souza", "Lima", "Pereira", "Ferreira", "Costa", "Rodrigues", "Almeida"]


def build_customers(rng: random.Random, amount: int = 45) -> list[tuple[str, str, str]]:
    customers = []
    for i in range(amount):
        first, last = rng.choice(FIRST_NAMES), rng.choice(LAST_NAMES)
        phone = f"119{rng.randint(10000000, 99999999)}"
        email = f"{first.lower().replace('í', 'i').replace('á', 'a').replace('é', 'e')}.{last.lower()}{i}@email.com"
        customers.append((f"{first} {last}", phone, email if rng.random() < 0.6 else ""))
    return customers


def run() -> None:
    Base.metadata.create_all(bind=engine)
    rng = random.Random(42)
    db = SessionLocal()
    try:
        existing = db.scalar(select(User).where(User.email == DEMO_EMAIL))
        if existing:
            if existing.business:
                db.delete(existing.business)
                db.flush()
            db.delete(existing)
            db.commit()

        user = User(name="Rafael Souza", email=DEMO_EMAIL, password_hash=hash_password(DEMO_PASSWORD))
        business = Business(
            owner=user,
            name="Navalha de Ouro",
            slug="navalha-de-ouro",
            category="Barbearia",
            description=(
                "Barbearia clássica com atendimento moderno. Café, cerveja gelada e o melhor "
                "corte da região. Agende em segundos e chegue só na hora."
            ),
            phone="1133224455",
            whatsapp="11987654321",
            instagram="navalhadeouro",
            address="Rua Augusta, 1500 - Consolação",
            city="São Paulo - SP",
            primary_color="#C08A2E",
            slot_interval_minutes=15,
            min_advance_minutes=30,
            max_days_ahead=30,
        )
        business.hours = default_hours()
        services = [
            Service(name=name, description=desc, duration_minutes=duration, price_cents=price)
            for name, desc, duration, price in SERVICES
        ]
        business.services = services
        professionals = []
        for name, role, color, service_indexes in PROFESSIONALS:
            professional = Professional(name=name, role=role, color=color)
            professional.services = [services[i] for i in service_indexes]
            professionals.append(professional)
        business.professionals = professionals
        db.add(user)
        db.flush()

        customers = build_customers(rng)
        regulars = customers[:12]  # clientes fiéis aparecem mais vezes
        now = business_now(business)
        today = now.date()
        used_codes: set[str] = set()

        def new_code() -> str:
            while True:
                code = "".join(rng.choice(CODE_ALPHABET) for _ in range(8))
                if code not in used_codes:
                    used_codes.add(code)
                    return code

        appointments = []
        for offset in range(-45, 8):
            day = today + timedelta(days=offset)
            hours = day_hours(business, day)
            if hours is None:
                continue
            for professional in professionals:
                busy: list[tuple[datetime, datetime]] = []
                fill_rate = 0.55 if offset < 0 else 0.35
                for _ in range(14):
                    service = rng.choice(professional.services)
                    free = compute_slots(day, hours, service.duration_minutes, business.slot_interval_minutes, busy)
                    if not free or rng.random() > fill_rate:
                        continue
                    start = rng.choice(free)
                    end = start + timedelta(minutes=service.duration_minutes)
                    busy.append((start, end))

                    name, phone, email = rng.choice(regulars) if rng.random() < 0.45 else rng.choice(customers)
                    if end <= now:
                        status = rng.choices(["completed", "no_show", "cancelled"], weights=[86, 5, 9])[0]
                    else:
                        status = rng.choices(["confirmed", "cancelled"], weights=[92, 8])[0]
                    appointments.append(
                        Appointment(
                            code=new_code(),
                            business_id=business.id,
                            service_id=service.id,
                            professional_id=professional.id,
                            customer_name=name,
                            customer_phone=phone,
                            customer_email=email,
                            notes=rng.choice(["", "", "", "Prefere máquina 2 nas laterais", "Primeira vez aqui"]),
                            start_at=start,
                            end_at=end,
                            price_cents=service.price_cents,
                            status=status,
                            source=rng.choices(["online", "manual"], weights=[75, 25])[0],
                            created_at=start - timedelta(days=rng.randint(0, 6), hours=rng.randint(1, 10)),
                        )
                    )
        db.add_all(appointments)

        # Exemplo de bloqueio: folga de um profissional daqui a 3 dias.
        day_off = today + timedelta(days=3)
        db.add(
            TimeOff(
                business_id=business.id,
                professional_id=professionals[1].id,
                start_at=datetime.combine(day_off, time(0, 0)),
                end_at=datetime.combine(day_off, time(23, 59)),
                reason="Folga",
            )
        )
        db.commit()
        print(f"✔ Demo criada com {len(appointments)} agendamentos.")
        print(f"  Login: {DEMO_EMAIL} / {DEMO_PASSWORD}")
        print("  Página pública: http://localhost:5173/b/navalha-de-ouro")
    finally:
        db.close()


def seed_if_empty() -> None:
    """Cria a demo só se ela ainda não existir (usado ao subir com SEED_DEMO=true)."""
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        exists = db.scalar(select(User.id).where(User.email == DEMO_EMAIL))
    if exists is None:
        run()


if __name__ == "__main__":
    run()
