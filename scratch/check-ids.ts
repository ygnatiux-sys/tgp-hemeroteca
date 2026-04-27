import { getCollection } from 'astro:content';

export async function checkIds() {
  const content = await getCollection('ensayosContent');
  console.log(content.map(c => c.id));
}
checkIds();
