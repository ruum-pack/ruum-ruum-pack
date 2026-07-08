declare const Deno: {
  env: {
    get(name: string): string | undefined;
  };
  serve(handler: (req: Request) => Promise<Response> | Response): void;
};

declare module "npm:stripe@^17" {
  const Stripe: any;
  export default Stripe;
}

declare module "npm:@supabase/supabase-js@2" {
  const createClient: any;
  export { createClient };
}
