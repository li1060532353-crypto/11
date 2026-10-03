import {it,expect} from 'vitest';
import {publicPost} from '../../../../functions/api/public/posts';
it('projects published snapshots without draft or management fields',()=>{
  const row={id:'private-id',slug:'draft-slug',public_slug:'public-slug',public_category:'published-category',public_tags_json:'["published-tag"]',public_is_featured:0,public_published_at:'2026-10-01T00:00:00Z',title:'SECRET DRAFT',summary:'DRAFT',content_json:'SECRET',published_title:'Public title',published_summary:'Public summary',published_content_json:'{"type":"doc","content":[]}',published_content_text:'Public text',published_at:'2026-10-02T00:00:00Z',category:'DRAFT category',is_featured:1,review_count:99};
  const result=publicPost(row);
  expect(result.title).toBe('Public title');
  expect(JSON.stringify(result)).not.toContain('SECRET');
  expect(result).not.toHaveProperty('id');
  expect(result).not.toHaveProperty('review_count');
  expect(result.slug).toBe('public-slug');
  expect(result.category).toBe('published-category');
  expect(result.tags).toEqual(['published-tag']);
  expect(result.selected).toBe(false);
  expect(result.publishedAt).toBe('2026-10-01T00:00:00Z');
});
