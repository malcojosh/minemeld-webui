/// <reference path="../../../typings/main.d.ts" />

import { INodeDetailResolverService } from '../../app/services/nodedetailresolver';
import { IMinemeldConfigService } from '../../app/services/config';
import { NodeDetailInfoController } from './nodedetail.info.controller';
import { IMinemeldStatus } from  '../../app/services/status';

/** @ngInject */
function autofocusExportListConfig($stateProvider: ng.ui.IStateProvider) {
    $stateProvider
        .state('nodedetail.autofocuselinfo', {
            templateUrl: 'app/nodedetail/autofocusel.info.html',
            controller: NodeDetailAutofocusELInfoController,
            controllerAs: 'nodedetailinfo'
        })
        ;
}

/** @ngInject */
function autofocusELRegisterClass(NodeDetailResolver: INodeDetailResolverService) {
    NodeDetailResolver.registerClass('minemeld.ft.autofocus.ExportList', {
        tabs: [{
            icon: 'fa fa-circle-o',
            tooltip: 'INFO',
            state: 'nodedetail.autofocuselinfo',
            active: false
        },
        {
            icon: 'fa fa-area-chart',
            tooltip: 'STATS',
            state: 'nodedetail.stats',
            active: false
        },
        {
            icon: 'fa fa-asterisk',
            tooltip: 'GRAPH',
            state: 'nodedetail.graph',
                active: false
        }]
    });
}

class NodeDetailAutofocusELInfoController extends NodeDetailInfoController {
    MinemeldConfig: IMinemeldConfigService;
    api_key: string;
    label: string;
    $modal: angular.ui.bootstrap.IModalService;

    /* @ngInject */
    constructor(toastr: any, $interval: angular.IIntervalService,
        MinemeldStatus: IMinemeldStatus,
        moment: moment.MomentStatic, $scope: angular.IScope,
        $compile: angular.ICompileService, $state: angular.ui.IStateService,
        $stateParams: angular.ui.IStateParamsService, MinemeldConfig: IMinemeldConfigService,
        $modal: angular.ui.bootstrap.IModalService) {
        this.MinemeldConfig = MinemeldConfig;
        this.$modal = $modal;

        super(toastr, $interval, MinemeldStatus, moment, $scope, $compile, $state, $stateParams);

        this.loadSideConfig();
    }

    loadSideConfig(): void {
        this.MinemeldConfig.getDataFile(this.nodename + '_side_config')
        .then((result: any) => {
            if (result.api_key) {
                this.api_key = result.api_key;
            } else {
                this.api_key = undefined;
            }

            if (result.label) {
                this.label = result.label;
            } else {
                this.label = undefined;
            }
        }, (error: any) => {
            this.toastr.error('ERROR RETRIEVING NODE SIDE CONFIG: ' + error.status);
            this.api_key = undefined;
            this.label = undefined;
        });
    }

    saveSideConfig(): angular.IPromise<any> {
        var side_config: any = {};

        if (this.api_key) {
            side_config.api_key = this.api_key;
        }
        if (this.label) {
            side_config.label = this.label;
        }

        return this.MinemeldConfig.saveDataFile(
            this.nodename + '_side_config',
            side_config,
            this.nodename
        );
    }

    setAPIKey(): void {
        var mi: angular.ui.bootstrap.IModalServiceInstance;

        mi = this.$modal.open({
            templateUrl: 'app/nodedetail/autofocus.sak.modal.html',
            controller: AutofocusSetAPIKeyController,
            controllerAs: 'vm',
            bindToController: true,
            backdrop: 'static',
            animation: false
        });

        mi.result.then((result: any) => {
            this.api_key = result.api_key;

            return this.saveSideConfig();
        })
        .then((result: any) => {
            this.toastr.success('API KEY SET');
        }, (error: any) => {
            this.toastr.error('ERROR SETTING API KEY: ' + error.status);
        });
    }

    setLabel(): void {
        var mi: angular.ui.bootstrap.IModalServiceInstance;

        mi = this.$modal.open({
            templateUrl: 'app/nodedetail/autofocus.sl.modal.html',
            controller: AutofocusSetLabelController,
            controllerAs: 'vm',
            bindToController: true,
            backdrop: 'static',
            animation: false,
            resolve: {
                label: () => { return this.label; }
            }
        });

        mi.result.then((result: any) => {
            this.label = result.label;

            return this.saveSideConfig();
        })
        .then((result: any) => {
            this.toastr.success('LABEL SET');
        }, (error: any) => {
            this.toastr.error('ERROR SETTING LABEL: ' + error.status);
        });
    }
}

class AutofocusSetAPIKeyController {
    $modalInstance: angular.ui.bootstrap.IModalServiceInstance;

    api_key: string;
    api_key2: string;

    valid(): boolean {
        if (this.api_key !== this.api_key2) {
            angular.element('#fgAPIKey1').addClass('has-error');
            angular.element('#fgAPIKey2').addClass('has-error');

            return false;
        }
        angular.element('#fgAPIKey1').removeClass('has-error');
        angular.element('#fgAPIKey2').removeClass('has-error');

        if (!this.api_key) {
            return false;
        }

        return true;
    }

    /** @ngInject */
    constructor($modalInstance: angular.ui.bootstrap.IModalServiceInstance) {
        this.$modalInstance = $modalInstance;
    }

    save() {
        var result: any = {};

        result.api_key = this.api_key;

        this.$modalInstance.close(result);
    }

    cancel() {
        this.$modalInstance.dismiss();
    }
};

class AutofocusSetLabelController {
    $modalInstance: angular.ui.bootstrap.IModalServiceInstance;

    label: string;

    valid(): boolean {
        if (!this.label) {
            return false;
        }

        return true;
    }

    /** @ngInject */
    constructor($modalInstance: angular.ui.bootstrap.IModalServiceInstance, label: string) {
        this.$modalInstance = $modalInstance;
        this.label = label;
    }

    save() {
        var result: any = {};

        result.label = this.label;

        this.$modalInstance.close(result);
    }

    cancel() {
        this.$modalInstance.dismiss();
    }
};

console.log('Loading Autofocus ExportList');
angular.module('minemeldWebui')
    .config(autofocusExportListConfig)
    .run(autofocusELRegisterClass)
    ;
