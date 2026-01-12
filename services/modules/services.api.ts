import apiClient from '../api/client';

export interface Service {
  id: string;
  name: string;
  description: string;
  categoryId: string;
  categoryName: string;
  defaultPrice: number | null;
  clinicId: string | null;
  isApproved: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateServiceData {
  name: string;
  description?: string;
  categoryId: string;
  defaultPrice?: number;
}

export interface UpdateServiceData {
  name?: string;
  description?: string;
  categoryId?: string;
  defaultPrice?: number;
}

class ServicesAPI {
  private basePath = '/services';

  /**
   * Get all services for the current clinic
   * Optionally filter by category
   */
  async getAll(categoryId?: string): Promise<Service[]> {
    const params = categoryId ? { categoryId } : {};
    const response = await apiClient.get<{ services: Service[] }>(this.basePath, { params });
    return response.data?.services || [];
  }

  /**
   * Get service by ID
   */
  async getById(id: string): Promise<Service> {
    const response = await apiClient.get<{ service: Service }>(`${this.basePath}/${id}`);
    if (!response.data?.service) {
      throw new Error('Service not found');
    }
    return response.data.service;
  }

  /**
   * Create a new service
   */
  async create(data: CreateServiceData): Promise<Service> {
    const response = await apiClient.post<{ service: Service }>(this.basePath, data);
    if (!response.data?.service) {
      throw new Error('Failed to create service');
    }
    return response.data.service;
  }

  /**
   * Update a service
   */
  async update(id: string, data: UpdateServiceData): Promise<Service> {
    const response = await apiClient.put<{ service: Service }>(`${this.basePath}/${id}`, data);
    if (!response.data?.service) {
      throw new Error('Failed to update service');
    }
    return response.data.service;
  }

  /**
   * Delete a service
   */
  async delete(id: string): Promise<void> {
    await apiClient.delete(`${this.basePath}/${id}`);
  }

  /**
   * Approve a service for global use (admin only)
   */
  async approve(id: string): Promise<Service> {
    const response = await apiClient.post<{ service: Service }>(`${this.basePath}/${id}/approve`);
    if (!response.data?.service) {
      throw new Error('Failed to approve service');
    }
    return response.data.service;
  }
}

export default new ServicesAPI();

