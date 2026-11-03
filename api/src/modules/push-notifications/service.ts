import { MedusaService } from "@medusajs/framework/utils"
import {
  PushCampaign,
  PushDelivery,
  PushSubscription,
} from "./models/push-subscription"
import { AdminPushSubscription } from "./models/admin-push-subscription"

class PushNotificationsService extends MedusaService({
  PushSubscription,
  PushCampaign,
  PushDelivery,
  AdminPushSubscription,
}) {}

export default PushNotificationsService
