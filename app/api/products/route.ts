import { parseProductSearch, searchProducts, SearchInputError } from "../../../lib/product-search";
import { routeError } from "../../../lib/marketplace";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    return Response.json(await searchProducts(parseProductSearch(new URL(request.url).searchParams)));
  } catch (error) {
    if (error instanceof SearchInputError) return Response.json({ error: error.message }, { status: 400 });
    return routeError(error);
  }
}
