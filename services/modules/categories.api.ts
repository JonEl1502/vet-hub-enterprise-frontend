import apiClient from '../api/client';

export interface Category {
  id: string;
  name: string;
  description: string;
  clinicId: string | null;
  isApproved: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCategoryData {
  name: string;
  description?: string;
}

export interface UpdateCategoryData {
  name?: string;
  description?: string;
}

class CategoriesAPI {
  private basePath = '/categories';

  /**
   * Get all categories for the current clinic
   */
  async getAll(): Promise<Category[]> {
    const response = await apiClient.get<{ categories: Category[] }>(this.basePath);
    return response.data?.categories || [];
  }

  /**
   * Get category by ID
   */
  async getById(id: string): Promise<Category> {
    const response = await apiClient.get<{ category: Category }>(`${this.basePath}/${id}`);
    if (!response.data?.category) {
      throw new Error('Category not found');
    }
    return response.data.category;
  }

  /**
   * Create a new category
   */
  async create(data: CreateCategoryData): Promise<Category> {
    const response = await apiClient.post<{ category: Category }>(this.basePath, data);
    if (!response.data?.category) {
      throw new Error('Failed to create category');
    }
    return response.data.category;
  }

  /**
   * Update a category
   */
  async update(id: string, data: UpdateCategoryData): Promise<Category> {
    const response = await apiClient.put<{ category: Category }>(`${this.basePath}/${id}`, data);
    if (!response.data?.category) {
      throw new Error('Failed to update category');
    }
    return response.data.category;
  }

  /**
   * Delete a category
   */
  async delete(id: string): Promise<void> {
    await apiClient.delete(`${this.basePath}/${id}`);
  }

  /**
   * Approve a category for global use (admin only)
   */
  async approve(id: string): Promise<Category> {
    const response = await apiClient.post<{ category: Category }>(`${this.basePath}/${id}/approve`);
    if (!response.data?.category) {
      throw new Error('Failed to approve category');
    }
    return response.data.category;
  }

  /** Per-clinic category catalog (global + custom) with the clinic's selection. */
  async catalog(): Promise<CatalogCategory[]> {
    const response = await apiClient.get<{ categories: CatalogCategory[] }>(`${this.basePath}/catalog/list`);
    return response.data?.categories || [];
  }

  /** Select / unselect a category for the clinic. */
  async setEnabled(id: string, enabled: boolean): Promise<{ categoryId: string; enabled: boolean }> {
    const response = await apiClient.put<{ categoryId: string; enabled: boolean }>(`${this.basePath}/${id}/override`, { enabled });
    return response.data as any;
  }
}

export interface CatalogCategory {
  id: string;
  name: string;
  description: string;
  isGlobal: boolean;
  enabled: boolean;
}

export default new CategoriesAPI();

