import { esNativo, plataformaActual } from "./capacitor";

export type NavigationTarget = {
  lat: number | null;
  lng: number | null;
  address: string;
};

export type NavigationOption = {
  id: "google" | "waze" | "apple";
  label: string;
  href: string;
  nativeHref?: string;
  webHref: string;
};

function destinationQuery(target: NavigationTarget) {
  if (target.lat !== null && target.lng !== null) return `${target.lat},${target.lng}`;
  return target.address;
}

function wazeDestinationParams(target: NavigationTarget) {
  if (target.lat !== null && target.lng !== null) {
    return `ll=${encodeURIComponent(`${target.lat},${target.lng}`)}`;
  }

  return `q=${encodeURIComponent(target.address)}`;
}

function isAppleWebPlatform() {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod|Mac/i.test(navigator.platform) || /iPad|iPhone|iPod|Mac OS/i.test(navigator.userAgent);
}

export function createNavigationOptions(target: NavigationTarget): NavigationOption[] {
  const destination = destinationQuery(target);
  const encoded = encodeURIComponent(destination);
  const wazeParams = wazeDestinationParams(target);
  const platform = plataformaActual();
  const native = esNativo();
  const googleWebHref = `https://www.google.com/maps/dir/?api=1&destination=${encoded}&travelmode=driving`;
  const wazeWebHref = `https://waze.com/ul?${wazeParams}&navigate=yes`;
  const appleWebHref = `https://maps.apple.com/?daddr=${encoded}&dirflg=d`;
  const options: NavigationOption[] = [
    {
      id: "google",
      label: "Google Maps",
      href: native ? `comgooglemaps://?daddr=${encoded}&directionsmode=driving` : googleWebHref,
      nativeHref: native ? `comgooglemaps://?daddr=${encoded}&directionsmode=driving` : undefined,
      webHref: googleWebHref
    },
    {
      id: "waze",
      label: "Waze",
      href: native ? `waze://?${wazeParams}&navigate=yes` : wazeWebHref,
      nativeHref: native ? `waze://?${wazeParams}&navigate=yes` : undefined,
      webHref: wazeWebHref
    }
  ];

  if (platform === "ios" || (platform === "web" && isAppleWebPlatform())) {
    const appleNativeHref = `maps://?daddr=${encoded}&dirflg=d`;
    options.push({
      id: "apple",
      label: "Apple Maps",
      href: native ? appleNativeHref : appleWebHref,
      nativeHref: native ? appleNativeHref : undefined,
      webHref: appleWebHref
    });
  }

  return options;
}
