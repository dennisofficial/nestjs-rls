import { DynamicModule, Global, InjectionToken, Module, ModuleMetadata, Provider } from '@nestjs/common';
import { getDataSourceToken } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import type { RlsContextConfig } from '../types';
import { Db } from './db.service';
import { RLS_CONTEXT } from './tokens';

export interface RlsModuleAsyncOptions {
  imports?: ModuleMetadata['imports'];
  inject?: InjectionToken[];
  useFactory: (...deps: any[]) => RlsContextConfig | Promise<RlsContextConfig>;
  /** Which TypeORM DataSource to scope against. Defaults to the app's default DataSource. */
  dataSource?: DataSource | string;
}

/**
 * Wires the scoped data layer. Global, so `Db` and `RLS_CONTEXT` are injectable everywhere
 * without re-importing. The app supplies `resolveContext`/`resolveClaims` via `useFactory` —
 * this module never reads request context itself (no CLS dependency).
 */
@Global()
@Module({})
export class RlsModule {
  static forRootAsync(options: RlsModuleAsyncOptions): DynamicModule {
    const contextProvider: Provider = {
      provide: RLS_CONTEXT,
      useFactory: options.useFactory,
      inject: options.inject ?? [],
    };

    const dbProvider: Provider = {
      provide: Db,
      useFactory: (dataSource: DataSource, ctx: RlsContextConfig) => new Db(dataSource, ctx),
      inject: [getDataSourceToken(options.dataSource), RLS_CONTEXT],
    };

    return {
      module: RlsModule,
      imports: options.imports ?? [],
      providers: [contextProvider, dbProvider],
      exports: [Db, RLS_CONTEXT],
    };
  }

  static forRoot(config: RlsContextConfig, dataSource?: DataSource | string): DynamicModule {
    return RlsModule.forRootAsync({ useFactory: () => config, dataSource });
  }
}
