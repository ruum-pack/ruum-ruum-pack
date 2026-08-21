import type { CapacitorConfig } from "@capacitor/cli";
const config: CapacitorConfig = {
  appId: "com.moviliax.ruumruum.conductor",
  appName: "Ruum Ruum Conductor",
  webDir: "cap-shell",
  server: {
    androidScheme: "https",
    cleartext: false,
    allowNavigation: ["www.concer.ruumruum-moviliax.online"]
  },
  android: {
    backgroundColor: "#151515",
    allowMixedContent: false
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: "#151515"
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"]
    }
  }
};
export default config;
