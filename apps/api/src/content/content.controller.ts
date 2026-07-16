import { Controller, Get, Inject, Param, Query } from '@nestjs/common';
import { apiSuccess } from '@namdw/shared';

import { ContentService } from './content.service';
import type { ListPostsOptions, PaginationOptions } from './content.types';

@Controller('content')
export class ContentController {
  constructor(@Inject(ContentService) private readonly contentService: ContentService) {}

  @Get('posts')
  async listPosts(@Query() query: ListPostsOptions) {
    return apiSuccess(await this.contentService.listPosts(query));
  }

  @Get('posts/:slug')
  async getPostBySlug(@Param('slug') slug: string) {
    return apiSuccess(await this.contentService.getPostBySlug(slug));
  }

  @Get('categories')
  async listCategories() {
    return apiSuccess(await this.contentService.listCategories());
  }

  @Get('categories/:slug/posts')
  async listPostsByCategory(@Param('slug') slug: string, @Query() query: PaginationOptions) {
    return apiSuccess(await this.contentService.listPostsByCategory(slug, query));
  }

  @Get('tags')
  async listTags() {
    return apiSuccess(await this.contentService.listTags());
  }

  @Get('tags/:slug/posts')
  async listPostsByTag(@Param('slug') slug: string, @Query() query: PaginationOptions) {
    return apiSuccess(await this.contentService.listPostsByTag(slug, query));
  }

  @Get('archives')
  async listArchives() {
    return apiSuccess(await this.contentService.listArchives());
  }

  @Get('projects')
  async listProjects() {
    return apiSuccess(await this.contentService.listProjects());
  }

  @Get('projects/:slug')
  async getProjectBySlug(@Param('slug') slug: string) {
    return apiSuccess(await this.contentService.getProjectBySlug(slug));
  }

  @Get('search')
  async searchPosts(@Query('q') query: string | undefined, @Query() options: PaginationOptions) {
    return apiSuccess(await this.contentService.searchPosts(query, options));
  }
}
