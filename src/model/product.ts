export interface Product {
  remoteId: string,
  vendor: string,
  link: string,
  thumbnail: string,
  title: string,
  description: string,
  createdAt: Date,
  updatedAt: Date,
  place: string,
  price: number,
  currency: string,
  images: Array<string>,
  attributes: Object,
  tags?: Array<string>,
}
