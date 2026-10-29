import { z } from "zod";

export const currencySchema = z.enum(["GHS"]);

export const productInputSchema = z.object({
  name: z.string().trim().min(1).max(150),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  description: z.string().max(5000),
  priceMinor: z.number().int().min(0).max(100_000_000),
  currency: currencySchema,
  sku: z.string().max(100).nullable().optional(),
  categoryId: z.string().min(1),
  images: z.array(
    z.object({
      url: z.string().url(),
      alt: z.string().max(250),
    }).strict(),
  ),
  stockQuantity: z.number().int().min(0),
  lowStockThreshold: z.number().int().min(0),
  isActive: z.boolean(),
  isFeatured: z.boolean(),
}).strict();

export const categoryInputSchema = z.object({
  name: z.string().trim().min(1).max(100),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  description: z.string().max(1000).optional().default(""),
  isActive: z.boolean(),
}).strict();

export const checkoutInputSchema = z.object({
  customerName: z.string().trim().min(2).max(150),
  customerPhone: z.string().regex(/^\+?[0-9][0-9 ()-]{7,18}$/),
  customerEmail: z.union([
    z.string().email(),
    z.literal(""),
  ]).optional().default(""),
  fulfillmentMethod: z.enum(["delivery", "collection"]),
  deliveryAddress: z.string().max(1000).default(""),
  notes: z.string().max(2000).default(""),
  items: z.array(
    z.object({
      productId: z.string().min(1),
      quantity: z.number().int().min(1).max(100),
    }).strict(),
  ).min(1).max(50),
  idempotencyKey: z.string().uuid(),
}).strict().superRefine((data, ctx) => {
  if (
    data.fulfillmentMethod === "delivery" &&
    data.deliveryAddress.trim().length === 0
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["deliveryAddress"],
      message: "A delivery address is required.",
    });
  }
});

export type ProductInput = z.infer<typeof productInputSchema>;
export type CategoryInput = z.infer<typeof categoryInputSchema>;
export type CheckoutInput = z.infer<typeof checkoutInputSchema>;
