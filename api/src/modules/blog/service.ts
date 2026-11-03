import { MedusaService } from "@medusajs/framework/utils"
import { BlogPost } from "./models/post"
import { BlogCategory } from "./models/category"
import { BlogAuthor } from "./models/author"

class BlogModuleService extends MedusaService({
  BlogPost,
  BlogCategory,
  BlogAuthor,
}) {}

export default BlogModuleService
