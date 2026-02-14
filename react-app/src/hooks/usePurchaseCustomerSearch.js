import { useEffect, useMemo, useState } from "react";
import { sb } from "../lib/supabaseClient";

const MIN_SEARCH_LENGTH = 2;

export function usePurchaseCustomerSearch({
  search,
  orders,
  debounceMs = 250,
  queryBuilder,
  postFilter
}) {
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const orderNameById = useMemo(() => {
    const map = new Map();
    (orders || []).forEach((order) => {
      map.set(String(order.id), order.orderName || "طلبية");
    });
    return map;
  }, [orders]);

  useEffect(() => {
    const query = String(search || "").trim();
    if (query.length < MIN_SEARCH_LENGTH) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }

    const orderIds = (orders || []).map((order) => order.id);
    if (!orderIds.length) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }

    const timer = window.setTimeout(async () => {
      setSearchLoading(true);
      try {
        let request = sb
          .from("purchases")
          .select("id, order_id, customer_name, price, created_at, pickup_point")
          .in("order_id", orderIds)
          .eq("collected", false)
          .ilike("customer_name", `%${query}%`)
          .order("created_at", { ascending: false })
          .limit(50);

        if (typeof queryBuilder === "function") {
          request = queryBuilder(request, { query, orderIds }) || request;
        }

        const { data, error } = await request;
        if (error) throw error;

        let list = data || [];
        if (typeof postFilter === "function") {
          list = list.filter((item) => postFilter(item, { query, orderIds }));
        }

        setSearchResults(
          list.map((item) => ({
            ...item,
            orderName: orderNameById.get(String(item.order_id)) || "طلبية"
          }))
        );
      } catch (error) {
        console.error(error);
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, debounceMs);

    return () => window.clearTimeout(timer);
  }, [debounceMs, orderNameById, orders, postFilter, queryBuilder, search]);

  const clearSearchResults = () => setSearchResults([]);

  return { searchResults, searchLoading, clearSearchResults };
}

