import type { ObjectLiteral, SelectQueryBuilder } from 'typeorm';
import { BadRequestException } from '@nestjs/common';
import { CURSOR_PAGE_SIZE, cursorRequest, makePageInfo, paginateRows } from './cursor.js';

/** Execute a keyset window inside the existing tenant/branch-scoped query. */
export async function cursorQueryRows<T extends ObjectLiteral>(query: SelectQueryBuilder<T>, paths: string[]): Promise<T[]> {
  const request = cursorRequest();
  if (!request || !paths.includes(request.path)) return query.getMany();
  const metadata = query.expressionMap.mainAlias?.metadata;
  const columns = metadata?.columns ?? [];
  const sort = request.sort ?? (columns.some(c => c.propertyName === 'createdAt') ? 'createdAt' : 'id');
  const id = columns.find(c => c.propertyName === 'id');
  const column = columns.find(c => c.propertyName === sort);
  // Derived fields/aggregate rows need their original projection before paging.
  if (!id || !column || request.filters.some(f => !columns.some(c => c.propertyName === f.field))) {
    const page = paginateRows(await query.getMany(),request);
    request.pageInfo = page.pageInfo;
    return page.data;
  }
  const alias = query.alias;
  const expression = `${alias}.${column.propertyName}`;
  const key = `${alias}.${id.propertyName}`;
  const base = query.clone().skip(undefined).take(undefined).offset(undefined).limit(undefined);
  request.filters.forEach((filter,index) => {
    const field = `${alias}.${filter.field}`, parameter = `cursorFilter${index}`;
    if (filter.op === 'in') {
      if (!Array.isArray(filter.value) || filter.value.length > 100) throw new BadRequestException('Invalid filter values');
      if (!filter.value.length) base.andWhere('1 = 0');
      else base.andWhere(`${field} IN (:...${parameter})`,{[parameter]:filter.value});
    } else if (filter.op === 'contains') base.andWhere(`CAST(${field} AS text) ILIKE :${parameter}`,{[parameter]:`%${String(filter.value)}%`});
    else base.andWhere(`${field} ${filter.op === 'gte' ? '>=' : filter.op === 'lte' ? '<=' : '='} :${parameter}`,{[parameter]:filter.value});
  });
  if (request.search) {
    const text = columns.filter(c => ['varchar','text','character varying'].includes(String(c.type)));
    if (text.length) base.andWhere(`(${text.map(c => `${alias}.${c.propertyName} ILIKE :cursorSearch`).join(' OR ')})`,{cursorSearch:`%${request.search}%`});
  }
  const total = await base.clone().getCount();
  const cursor = request.cursor;
  const ascending = request.order === 'asc';
  const backwards = cursor?.direction === 'previous';
  const comparison = (ascending !== backwards) ? '>' : '<';
  if (cursor) {
    const anchor = cursor.anchor;
    let condition: string;
    if (anchor.value === null) condition = backwards ? `(${expression} IS NOT NULL OR (${expression} IS NULL AND ${key} ${comparison} :cursorKey))` : `(${expression} IS NULL AND ${key} ${comparison} :cursorKey)`;
    else {
      const compare = `(${expression} ${comparison} :cursorValue OR (${expression} = :cursorValue AND ${key} ${comparison} :cursorKey))`;
      condition = backwards ? `(${expression} IS NOT NULL AND ${compare})` : `(${expression} IS NULL OR ${compare})`;
    }
    base.andWhere(condition,{cursorValue:anchor.value,cursorKey:anchor.key});
  }
  const order = ascending !== backwards ? 'ASC' : 'DESC';
  const result = await base.orderBy(expression,order,backwards ? 'NULLS FIRST' : 'NULLS LAST').addOrderBy(key,order).take(CURSOR_PAGE_SIZE + 1).getMany();
  const more = result.length > CURSOR_PAGE_SIZE;
  const rows = result.slice(0,CURSOR_PAGE_SIZE);
  if (backwards) rows.reverse();
  const page = cursor?.page ?? 1;
  request.pageInfo = makePageInfo(rows,total,backwards ? more : !!cursor,backwards ? true : more,(page - 1) * CURSOR_PAGE_SIZE + 1,request,sort);
  return rows;
}
