import { Link } from "react-router-dom";
import Logo from "../components/Logo";

export default function NotFound() {
  return (
    <div className="not-found">
      <Logo />
      <p className="not-found__code">404</p>
      <h1>Esta página não existe.</h1>
      <p>Confira o endereço ou volte para o início.</p>
      <Link to="/" className="btn btn--primary">
        Ir para o início
      </Link>
    </div>
  );
}
