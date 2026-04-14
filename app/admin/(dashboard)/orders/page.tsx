import { getOrders } from "@/actions/orders";
import { OrdersClient } from "@/components/admin/OrdersClient";

export default async function OrdersPage() {
  const orders = await getOrders();
  return <OrdersClient orders={orders} />;
}
