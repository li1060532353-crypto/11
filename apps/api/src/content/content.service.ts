import { Inject, Injectable, NotFoundException } from '@nestjs/common';

import { ContentRepository } from './content.repository';
import type { ListPostsOptions, PaginationOptions } from './content.types';

@Injectable()
export class ContentService {
  constructor(@Inject(ContentRepository) private readonly repository: ContentRepository) {}

  listPosts(options: ListPostsOptions = {}) {
    return this.repository.listPosts(options);
  }

  listPostsByCategory(category: string, options: PaginationOptions = {}) {
    return this.repository.listPostsByCategory(category, options);
  }

  listPostsByTag(tag: string, options: PaginationOptions = {}) {
    return this.repository.listPostsByTag(tag, options);
  }

  async getPostBySlug(slug: string) {
    const post = await this.repository.getPostBySlug(slug);

    if (!post) {
      throw new NotFoundException(`Post not found: ${slug}`);
    }

    return post;
  }

  listCategories() {
    return this.repository.listCategories();
  }

  listTags() {
    return this.repository.listTags();
  }

  listArchives() {
    return this.repository.listArchives();
  }

  listProjects() {
    return this.repository.listProjects();
  }

  async getProjectBySlug(slug: string) {
    const project = await this.repository.getProjectBySlug(slug);

    if (!project) {
      throw new NotFoundException(`Project not found: ${slug}`);
    }

    return project;
  }

  searchPosts(query: unknown, options: PaginationOptions = {}) {
    return this.repository.searchPosts(query, options);
  }
}
