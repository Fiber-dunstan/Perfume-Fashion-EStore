import { describe, expect, it } from "vitest";
import {
  categoryInputSchema,
  checkoutInputSchema,
  productInputSchema,
} from "../src/schemas/store";

describe("Product validation", () => {
  it("rejects a negative price", () => {
    const result = productInputSchema.safeParse({
      name: "Rose Perfume",
      slug: "rose-perfume",
      description: "A floral fragrance",
      priceMinor: -100,
      currency: "GHS",
      categoryId: "category-1",
      images: [],
      stockQuantity: 5,
      lowStockThreshold: 1,
      isActive: true,
      isFeatured: false,
    });

    expect(result.success).toBe(false);
  });

  it("rejects negative stock", () => {
    const result = productInputSchema.safeParse({
      name: "Rose Perfume",
      slug: "rose-perfume",
      description: "A floral fragrance",
      priceMinor: 25000,
      currency: "GHS",
      categoryId: "category-1",
      images: [],
      stockQuantity: -1,
      lowStockThreshold: 1,
      isActive: true,
      isFeatured: false,
    });

    expect(result.success).toBe(false);
  });
});

describe("Category validation", () => {
  it("rejects an invalid slug", () => {
    const result = categoryInputSchema.safeParse({
      name: "Perfumes",
      slug: "Perfumes & Scents!",
      description: "",
      isActive: true,
    });

    expect(result.success).toBe(false);
  });
});

describe("Checkout validation", () => {
  const checkout = {
    customerName: "Ama Mensah",
    customerPhone: "0241234567",
    customerEmail: "",
    fulfillmentMethod: "delivery",
    deliveryAddress: "",
    notes: "",
    items: [{ productId: "product-1", quantity: 1 }],
    idempotencyKey: "550e8400-e29b-41d4-a716-446655440000",
  };

  it("requires a delivery address for delivery orders", () => {
    expect(checkoutInputSchema.safeParse(checkout).success).toBe(false);
  });

  it("accepts a delivery order with an address", () => {
    expect(
      checkoutInputSchema.safeParse({
        ...checkout,
        deliveryAddress: "Kumasi, Ghana",
      }).success,
    ).toBe(true);
  });

  it("rejects a quantity of zero", () => {
    expect(
      checkoutInputSchema.safeParse({
        ...checkout,
        deliveryAddress: "Kumasi, Ghana",
        items: [{ productId: "product-1", quantity: 0 }],
      }).success,
    ).toBe(false);
  });
});
