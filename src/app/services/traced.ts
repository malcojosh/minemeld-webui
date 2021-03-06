/// <reference path="../../../typings/main.d.ts" />

import { IMinemeldAuth } from './auth';
import { IMinemeldEvents } from './events';

export interface IMinemeldTracedQueryOptions {
    query?: string;
    timestamp?: number;
    counter?: number;
    numLines?: number;
    ondata?: Function;
    onerror?: Function;
}

interface IMinemeldTracedQueryOptionsInt extends IMinemeldTracedQueryOptions {
    subscriptionID?: number;
    queryStarted?: boolean;
}

export interface IMinemeldTraced {
    query(qid: string, options?: IMinemeldTracedQueryOptions);
    generateQueryID(): string;
    closeAll(): void;
}

interface IMinemeldTracedQueryParams {
    uuid: string;
    q?: string;
    ts?: number;
    c?: number;
    nl?: number;
}

export class MinemeldTraced implements IMinemeldTraced {
    $resource: angular.resource.IResourceService;
    $state: angular.ui.IStateService;
    MinemeldAuth: IMinemeldAuth;
    MinemeldEvents: IMinemeldEvents;

    queries: { [qid: string]: IMinemeldTracedQueryOptionsInt };

    /* @ngInject */
    constructor($resource: angular.resource.IResourceService,
                $state: angular.ui.IStateService,
                MinemeldAuth: IMinemeldAuth, MinemeldEvents: IMinemeldEvents) {
        this.$resource = $resource;
        this.$state = $state;
        this.MinemeldAuth = MinemeldAuth;
        this.MinemeldEvents = MinemeldEvents;

        this.queries = {};
    }

    query(qid: string, options?: IMinemeldTracedQueryOptions): void {
        var sid: number;

        this.queries[qid] = options;

        this.queries[qid].queryStarted = false;
        sid = this.MinemeldEvents.subscribeQueryEvents(qid, {
            onopen: this.subscriptionOpen.bind(this),
            onmessage: this.queryMessage.bind(this),
            onerror: this.queryError.bind(this)
        });
        this.queries[qid].subscriptionID = sid;
    }

    closeAll(): void {
        angular.forEach(this.queries, (query: IMinemeldTracedQueryOptionsInt, qid: string) => {
            this.killQuery(qid);
            this.MinemeldEvents.unsubscribe(query.subscriptionID);
        });
        this.queries = {};
    }

    generateQueryID(): string {
        var result: string;

        result = this.generateUUID();
        while (result in this.queries) {
            result = this.generateUUID();
        }

        return result;
    }

    private sendQuery(qid: string, options?: IMinemeldTracedQueryOptions): any {
        var params: IMinemeldTracedQueryParams;
        var qResource: angular.resource.IResourceClass<angular.resource.IResource<any>>;

        if (!this.MinemeldAuth.authorizationSet) {
            this.$state.go('login');
            return;
        }

        params = {
            uuid: qid
        };
        if (options) {
            if (options.timestamp) {
                params.ts = options.timestamp;
            }
            if (options.counter) {
                params.c = options.counter;
            }
            if (options.numLines) {
                params.nl = options.numLines;
            }
            if (options.query) {
                params.q = options.query;
            }
        }

        qResource = this.$resource('/traced/query', {}, {
            get: {
                method: 'GET',
                headers: this.MinemeldAuth.getAuthorizationHeaders()
            }
        });

        return qResource.get(params).$promise;
    }

    private killQuery(qid: string): any {
        var qResource: angular.resource.IResourceClass<angular.resource.IResource<any>>;

        if (!this.MinemeldAuth.authorizationSet) {
            this.$state.go('login');
            return;
        }

        qResource = this.$resource('/traced/query/' + qid + '/kill', {}, {
            get: {
                method: 'GET',
                headers: this.MinemeldAuth.getAuthorizationHeaders()
            }
        });

        return qResource.get().$promise;
    }

    private subscriptionOpen(t: string, qid: string, data: any) {
        var q: IMinemeldTracedQueryOptionsInt;

        if (t !== 'query') {
            return;
        }

        q = this.queries[qid];
        if (!q) {
            return;
        }
        if (q.queryStarted) {
            return;
        }
        q.queryStarted = true;

        this.sendQuery(qid, q).catch((error: any) => {
            this.MinemeldEvents.unsubscribe(q.subscriptionID);
            delete this.queries[qid];

            if (q.onerror) {
                q.onerror(qid, error);
            }
        });
    }

    private queryMessage(t: string, qid: string, data: any) {
        var q: IMinemeldTracedQueryOptionsInt;

        if (t !== 'query') {
            return;
        }

        q = this.queries[qid];
        if (!q) {
            return;
        }

        if (q.ondata) {
            q.ondata(qid, data);
        }

        if (data.msg && data.msg === '<EOQ>') {
            this.MinemeldEvents.unsubscribe(q.subscriptionID);
            delete this.queries[qid];
        }
    }

    private queryError(t: string, qid: string, data: any) {
        var q: IMinemeldTracedQueryOptions;

        if (t !== 'query') {
            return;
        }

        q = this.queries[qid];
        if (!q) {
            return;
        }

        if (q.onerror) {
            q.onerror(qid, data);
        }
    }

    private generateUUID(): string {
        var d: number = new Date().getTime();
        var uuid: string = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx';

        if (window.performance && typeof window.performance.now === 'function') {
            d += performance.now();
        }

        uuid = uuid.replace(/[xy]/g, function(c: string) {
            var r = (d + Math.random() * 16) % 16 | 0;
            d = Math.floor(d / 16);
            return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
        });

        return uuid;
    }
}
