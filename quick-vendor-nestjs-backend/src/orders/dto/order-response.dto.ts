import { Order, Product } from '@prisma/client';

type OrderWithProduct = Order & {
  product: Pick<Product, 'id' | 'name' | 'price' | 'imageUrl1'>;
};

export class OrderResponseDto {
  id: string;
  reference: string;
  status: string;
  quantity: number;
  amount: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;
  product: {
    id: string;
    name: string;
    price: number;
    imageUrl: string | null;
  };
  paidAt: Date | null;
  confirmedAt: Date | null;
  fulfilledAt: Date | null;
  cancelledAt: Date | null;
  createdAt: Date;

  static from(order: OrderWithProduct): OrderResponseDto {
    return {
      id: order.id,
      reference: order.reference,
      status: order.status,
      quantity: order.quantity,
      amount: order.amount,
      customerName: order.customerName,
      customerEmail: order.customerEmail,
      customerPhone: order.customerPhone,
      product: {
        id: order.product.id,
        name: order.product.name,
        price: order.product.price,
        imageUrl: order.product.imageUrl1,
      },
      paidAt: order.paidAt,
      confirmedAt: order.confirmedAt,
      fulfilledAt: order.fulfilledAt,
      cancelledAt: order.cancelledAt,
      createdAt: order.createdAt,
    };
  }
}
