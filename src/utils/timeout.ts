// Uma leitura do Firestore/Auth que não responde (rede presa, canal travado no
// Safari do iPhone) deixava botões e telas "carregando" para sempre. Isto põe
// um teto: se a promessa não terminar a tempo, falha com o código "timeout"
// para a tela mostrar um aviso e deixar a pessoa tentar de novo.
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      const err = new Error('A operação demorou demais para responder.') as Error & { code: string };
      err.code = 'timeout';
      reject(err);
    }, ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}
