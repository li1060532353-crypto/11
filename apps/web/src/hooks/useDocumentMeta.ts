import { useEffect } from 'react';

type DocumentMeta = {
  title: string;
  description: string;
};

export function useDocumentMeta({ title, description }: DocumentMeta): void {
  useEffect(() => {
    document.title = title;

    let descriptionMeta = document.head.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (!descriptionMeta) {
      descriptionMeta = document.createElement('meta');
      descriptionMeta.name = 'description';
      document.head.append(descriptionMeta);
    }
    descriptionMeta.content = description;
  }, [description, title]);
}
