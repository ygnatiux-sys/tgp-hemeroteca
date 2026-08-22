export const prerender = false; // <-- Esta es la orden absoluta que enciende el SSR

export async function GET() {
  return new Response(JSON.stringify({ motor: "encendido" }));
}
