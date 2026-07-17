import { plataformaActual } from "./capacitor";

export type NavigationTarget = {
  lat: number | null;
  lng: number | null;
  address: string;
};

export type NavigationOption = {
  id: "google" | "waze" | "apple";
  label: string;
  href: string;
};

function destinationQuery(target: NavigationTarget) {
  if (target.lat !== null && target.lng !== null) return `${target.lat},${target.lng}`;
  return target.address;
}

function isAppleWebPlatform() {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod|Mac/i.test(navigator.platform) || /iPad|iPhone|iPod|Mac OS/i.test(navigator.userAgent);
}

export function createNavigationOptions(target: NavigationTarget): NavigationOption[] {
  const destination = destinationQuery(target);
  const encoded = encodeURIComponent(destination);
  const platform = plataformaActual();
  const options: NavigationOption[] = [
    {
      id: "google",
      label: "Google Maps",
      href: `https://www.google.com/maps/dir/?api=1&destination=${encoded}&travelmode=driving`
    },
    {
      id: "waze",
      label: "Waze",
      href: `https://waze.com/ul?q=${encoded}&navigate=yes`
    }
  ];

  if (platform === "ios" || (platform === "web" && isAppleWebPlatform())) {
    options.push({
      id: "apple",
      label: "Apple Maps",
      href: `https://maps.apple.com/?daddr=${encoded}&dirflg=d`
    });
  }

  return options;
}
