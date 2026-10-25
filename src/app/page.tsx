export default function HomePage() {
  return (
    <main style={{ maxWidth: 720, margin: "40px auto", padding: "20px" }}>
      <h1>Dogfood</h1>
      <p>Offline-first, self-hostable hackathon submission and judging platform.</p>
      <ul>
        <li><a href="/gallery">Public project gallery</a></li>
        <li><a href="/api/gallery">Gallery API (JSON)</a></li>
        <li><a href="/api/health">/api/health</a> · <a href="/api/ready">/api/ready</a></li>
      </ul>
      <p>
        The portal is API-first; see the README for endpoints and the seeded demo accounts.
      </p>
    </main>
  );
}
