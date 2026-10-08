import { AdultAccessPageClient } from "./AdultAccessPageClient";

function getSafeReturnTo(path: string | undefined): string {
  if (!path) {
    return "/";
  }

  const destination = new URL(path, "https://animan.invalid");
  if (destination.origin !== "https://animan.invalid") {
    return "/";
  }

  return `${destination.pathname}${destination.search}${destination.hash}`;
}

export default async function AgeCheckPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string | string[] }>;
}) {
  const params = await searchParams;
  return (
    <AdultAccessPageClient
      returnTo={getSafeReturnTo(
        Array.isArray(params.returnTo) ? params.returnTo[0] : params.returnTo,
      )}
    />
  );
}
