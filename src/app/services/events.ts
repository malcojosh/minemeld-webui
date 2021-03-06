/// <reference path="../../../typings/main.d.ts" />

import { IMinemeldAuth } from './auth';

export interface IMinemeldEvents {
    subscribeQueryEvents(query: string, callback: any): number;
    unsubscribe(subscription: number): void;
}

interface ISubscription {
    subType: string;
    topic: string;
    callbacks: ISubscriptionsCallbacks;
    _id: number;
}

interface IEventSource extends EventTarget {
    new (url: string, eventSourceInitDict?: any);

    url: string;
    eventSourceInitDict: any;

    CONNECTING: number;
    OPEN: number;
    CLOSED: number;
    readyState: number;

    onopen: Function;
    onmessage: Function;
    onerror: Function;

    close(): void;
}

export interface ISubscriptionsCallbacks {
    onopen?: Function;
    onmessage?: Function;
    onerror?: Function;
}

declare var pfEventSource: IEventSource;

export class MinemeldEvents implements IMinemeldEvents {
    authorizationSet: boolean = false;
    authorizationString: string;

    $state: angular.ui.IStateService;
    MinemeldAuth: IMinemeldAuth;

    subscriptions: ISubscription[] = [];
    last_id: number = -1;

    event_sources: { [topic: string]: IEventSource } = {};

    /* @ngInject */
    constructor($state: angular.ui.IStateService,
                MinemeldAuth: IMinemeldAuth) {
        this.$state = $state;
        this.MinemeldAuth = MinemeldAuth;
    }

    subscribeQueryEvents(query: string, callbacks: ISubscriptionsCallbacks): number {
        if (!this.MinemeldAuth.authorizationSet) {
            this.$state.go('login');
            return;
        }

        this.last_id += 1;

        var sub: ISubscription = {
            subType: 'query',
            topic: query,
            callbacks: callbacks,
            _id: this.last_id
        };

        this.subscriptions.push(sub);
        this.createEventSource(sub.subType, sub.topic);

        return sub._id;
    }

    unsubscribe(_id: number): void {
        var j: number = this.subscriptions.length;
        var csub: ISubscription;

        while (j--) {
            if (this.subscriptions[j]._id === _id) {
                csub = this.subscriptions[j];
                this.subscriptions.splice(j, 1);
                this.deleteEventSource(csub.subType, csub.topic);
                break;
            }
        }
    }

    private onMessage(subtype: string, event: string, e: any) {
        if ((e.data === 'ok') || (e.data === 'ko')) {
            return;
        }
        angular.forEach(this.subscriptions, (sub: ISubscription) => {
           if ((sub.subType !== subtype) || (sub.topic !== event)) {
               return;
           }
           if (sub.callbacks.onmessage) {
               sub.callbacks.onmessage(subtype, event, JSON.parse(e.data));
           }
        });
    }

    private onOpen(subtype: string, event: string, e: any) {
        angular.forEach(this.subscriptions, (sub: ISubscription) => {
           if ((sub.subType !== subtype) || (sub.topic !== event)) {
               return;
           }
           if (sub.callbacks.onopen) {
               sub.callbacks.onopen(subtype, event, e);
           }
        });
    }

    private onError(subtype: string, event: string, e: any) {
        angular.forEach(this.subscriptions, (sub: ISubscription) => {
           if ((sub.subType !== subtype) || (sub.topic !== event)) {
               return;
           }
           if (sub.callbacks.onerror) {
               sub.callbacks.onerror(subtype, event, e);
           }
        });
    }

    private createEventSource(subtype: string, event: string): void {
        var new_es: IEventSource;
        var ruri: string = subtype + '/' + event;
        var headers: any;

        if (ruri in this.event_sources) {
            return;
        }

        headers = this.MinemeldAuth.getAuthorizationHeaders();
        headers['Accept'] = 'text/event-stream';
        headers['Cache-Control'] = 'no-cache';
        headers['X-Requested-With'] = 'XMLHttpRequest';

        new_es = new pfEventSource('/status/events/' + ruri, {
            getArgs: null,
            xhrHeaders: headers
        });

        new_es.onmessage = (e: any) => { this.onMessage(subtype, event, e); };
        new_es.onopen = (e: any) => { this.onOpen(subtype, event, e); };
        new_es.onerror = (e: any) => { this.onError(subtype, event, e); };

        this.event_sources[ruri] = new_es;
    }

    private deleteEventSource(subtype: string, event: string): void {
        var nref: number = 0;
        var ruri: string = subtype + '/' + event;

        if (!(ruri in this.event_sources)) {
            return;
        }

        angular.forEach(this.subscriptions, (sub: ISubscription) => {
            if ((sub.topic === event) && (sub.subType === subtype)) {
                nref += 1;
            }
        });

        if (nref !== 0) {
            return;
        }

        this.event_sources[ruri].close();
        delete this.event_sources[ruri];
    }
}
