import { Body, Controller, Get, MessageEvent, NotFoundException, Param, Post, Sse } from '@nestjs/common';
import { interval, map, Observable } from 'rxjs';
import { z } from 'zod';

const createCat = z.object({ name: z.string().min(1), age: z.number().int().nonnegative() });
type Cat = z.infer<typeof createCat> & { id: number };

@Controller('cats')
export class CatsController {
  private cats: Cat[] = [{ id: 1, name: 'Tom', age: 3 }];

  @Get()
  list() {
    return this.cats;
  }

  @Post()
  create(@Body({ schema: createCat }) dto: z.infer<typeof createCat>) {
    const cat = { id: this.cats.length + 1, ...dto };
    this.cats.push(cat);
    return cat;
  }

  /** Server-Sent Events work out of the box: curl -N http://localhost:3000/cats/live */
  @Sse('live')
  live(): Observable<MessageEvent> {
    return interval(1000).pipe(map((i) => ({ data: { tick: i, cats: this.cats.length } })));
  }

  // Declared after `live` on purpose: routes match in declaration order, so `:id` would shadow it.
  @Get(':id')
  one(@Param('id', { schema: z.coerce.number().int() }) id: number) {
    const cat = this.cats.find((c) => c.id === id);
    if (!cat) throw new NotFoundException(`Cat ${id} not found`);
    return cat;
  }
}
