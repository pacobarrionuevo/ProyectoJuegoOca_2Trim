import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ImageService {
  private baseURL = 'https://localhost:7077/images';

  constructor() {}

  getImageUrl(imageName: string): string {
    return `${this.baseURL}/${imageName}`;
  }
}