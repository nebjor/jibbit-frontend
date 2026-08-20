import { getSearchDocs } from "@/lib/search/server";
import { SearchBox } from "./SearchBox";

/**
 * Server half of the instant search: builds the search index docs from the
 * data layer (tenant-resolved at request time, mock fallback included) and
 * hands them to the client combobox as props.
 *
 * The header lives in the root LAYOUT, and the app router caches layouts
 * client-side across soft navigations — so the index is paid for once per
 * full page load, not once per navigation. Measured payload for the current
 * catalogue is in the PR description.
 */
export async function SearchBar() {
  const docs = await getSearchDocs();
  return <SearchBox docs={docs} />;
}
