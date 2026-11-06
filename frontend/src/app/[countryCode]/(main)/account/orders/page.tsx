// User-specific page - opt out of static prerender.
export const dynamic = "force-dynamic"
import { Metadata } from "next"

import OrderOverview from "@modules/account/components/order-overview"
import AccountPageHeader from "@modules/account/components/page-header"
import GuestDashboard from "@modules/account/components/guest-dashboard"
import { redirect } from "next/navigation"
import { retrieveCustomer } from "@lib/data/customer"
import { listOrders } from "@lib/data/orders"
import Divider from "@modules/common/components/divider"
import TransferRequestForm from "@modules/account/components/transfer-request-form"

export const metadata: Metadata = {
  title: "Orders",
  description: "Overview of your previous orders.",
  robots: { index: false, follow: false },
}

export default async function Orders() {
  // The footer's "Track order" link lands here, mostly from guest
  // (cash-on-delivery) shoppers who never logged in. Listing orders needs
  // a signed-in customer — without one it threw and the page rendered
  // empty — so guests get the guest dashboard with their orders instead.
  const customer = await retrieveCustomer().catch(() => null)
  if (!customer) {
    return <GuestDashboard />
  }

  const orders = await listOrders().catch(() => null)

  if (!orders) {
    redirect("/my-account/")
  }

  return (
    <div className="w-full" data-testid="orders-page-wrapper">
      <AccountPageHeader
        icon="ph-package"
        title="My orders"
        subtitle="View your previous orders and request returns or exchanges if needed."
      />
      <div>
        <OrderOverview orders={orders} />
        <Divider className="my-12" />
        <TransferRequestForm />
      </div>
    </div>
  )
}
