export default function Splash({ children = "Carregando…" }) {
  return (
    <div className="splash" role="status">
      {children}
    </div>
  );
}
