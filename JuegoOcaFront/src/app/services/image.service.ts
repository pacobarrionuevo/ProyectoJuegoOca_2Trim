import { Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { Result } from '../models/result';
import { Image } from '../models/image';
import { CreateOrUpdateImageRequest } from '../models/create-update-image-request';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ImageService {

  private baseURL = `${environment.apiUrl}/images`;

  constructor(private api: ApiService) { }

  getImageUrl(imageName: string): string {
    return `${this.baseURL}/${imageName}`;
  }

  getAllImages(): Promise<Result<Image[]>> {
    return this.api.get<Image[]>('images');
  }

  addImage(createOrUpdateImageRequest: CreateOrUpdateImageRequest): Promise<Result<Image>> {
    const formData = new FormData();
    formData.append('name', createOrUpdateImageRequest.name);
    formData.append('file', createOrUpdateImageRequest.file);

    return this.api.post<Image>('images', formData);
  }

  updateImage(id: number, createOrUpdateImageRequest: CreateOrUpdateImageRequest): Promise<Result> {
    const formData = new FormData();
    formData.append('name', createOrUpdateImageRequest.name);
    formData.append('file', createOrUpdateImageRequest.file);

    return this.api.put(`images/${id}`, formData);
  }

  deleteImage(id: number): Promise<Result> {
    return this.api.delete(`images/${id}`);
  }
}
