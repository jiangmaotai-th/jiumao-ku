export async function createAudioContext() {
  const context = new AudioContext();
  return {
    context,
    async unlock() {
      if (context.state === "suspended") await context.resume();
    },
    async dispose() {
      if (context.state !== "closed") await context.close();
    },
  };
}
