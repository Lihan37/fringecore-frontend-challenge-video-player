import VideoPlayer from "./VideoPlayer";

export default function App() {
  return (
    <main className="min-h-screen grid place-items-center bg-neutral-950">
      {/* uses public/demo.mp4 */}
      <VideoPlayer src="/demo.mp4" />
    </main>
  );
}
