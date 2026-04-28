import { getCollection } from 'astro:content';

export async function listEntries() {
  const essays = await getCollection('ensayos');
  const contents = await getCollection('ensayosContent');
  
  console.log('--- ENSAYOS ---');
  essays.forEach(e => console.log(e.id));
  
  console.log('--- ENSAYOS CONTENT ---');
  contents.forEach(e => console.log(e.id));
}
