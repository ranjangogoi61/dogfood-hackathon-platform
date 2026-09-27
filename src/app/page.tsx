export default function HomePage() {
  return (
    <main style={{ maxWidth: 720, margin: "40px auto", padding: "20px" }}>
      <h1>Dogfood</h1>

      <p>
        Offline-first, self-hostable hackathon submission and judging platform.
      </p>

      <ul>
        <li>/api/health</li>
        <li>/api/ready</li>
      </ul>

      <p>Foundation phase.</p>
    </main>
  );
}
