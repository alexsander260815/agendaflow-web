import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.agendaflowpro.app',
  appName: 'AgendaFlow Pro',
  webDir: 'ios-web',
  server: {
    // O app carrega o site publicado direto (mesma versão que roda no
    // navegador), em vez de empacotar arquivos junto no app. Assim,
    // qualquer atualização feita no site (git push -> Vercel) aparece
    // pro usuário do app na hora, sem precisar mandar atualização nova
    // pra App Store.
    url: 'https://agendaflow-web-six.vercel.app',
    cleartext: false
  },
  ios: {
    contentInset: 'automatic'
  }
};

export default config;
