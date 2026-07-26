/**
 * Purely decorative. Transform and opacity only, so it stays off the main
 * thread and costs nothing to leave running.
 */
export function Atmosphere() {
  return (
    <>
      <div className="atmo" aria-hidden="true">
        <div className="grid far" />
        <div className="grid" />
        <div className="pool a" />
        <div className="pool b" />
        <div className="pool c" />
        <div className="horizon" />
      </div>
      <div className="scan" aria-hidden="true" />
    </>
  );
}
