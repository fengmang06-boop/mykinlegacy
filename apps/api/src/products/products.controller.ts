import { Controller, Get, Param } from "@nestjs/common";

import { ProductsService } from "./products.service";

@Controller("products")
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  listProducts() {
    return this.productsService.listProducts();
  }

  @Get(":productCode")
  getProduct(@Param("productCode") productCode: string) {
    return this.productsService.getProduct(productCode);
  }
}
