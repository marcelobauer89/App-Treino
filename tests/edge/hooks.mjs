// Troca os imports npm: da Edge Function por stubs vazios (o teste injeta banco e envio falsos).
export async function resolve(spec, ctx, next) {
  if (spec.startsWith('npm:')) return { url: 'data:text/javascript,export const createClient=()=>{};export default {createTransport(){}};', shortCircuit: true };
  return next(spec, ctx);
}
