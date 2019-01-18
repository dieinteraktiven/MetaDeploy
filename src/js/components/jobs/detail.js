// @flow

import * as React from 'react';
import Button from '@salesforce/design-system-react/components/button';
import DocumentTitle from 'react-document-title';
import { connect } from 'react-redux';

import routes from 'utils/routes';
import { CONSTANTS } from 'plans/reducer';
import { fetchJob, updateJob, requestCancelJob } from 'jobs/actions';
import { fetchVersion } from 'products/actions';
import { selectJob, selectJobId } from 'jobs/selectors';
import { selectPlan } from 'plans/selectors';
import {
  selectProduct,
  selectVersion,
  selectVersionLabel,
} from 'products/selectors';
import { selectUserState } from 'user/selectors';
import { shouldFetchVersion, getLoadingOrNotFound } from 'products/utils';

import BodyContainer from 'components/bodyContainer';
import CtaButton from 'components/jobs/ctaButton';
import Header from 'components/plans/header';
import Intro from 'components/plans/intro';
import JobMessage from 'components/jobs/jobMessage';
import JobResults from 'components/plans/jobResults';
import ProductNotFound from 'components/products/product404';
import ProgressBar from 'components/jobs/progressBar';
import ShareModal from 'components/jobs/shareModal';
import StepsTable from 'components/plans/stepsTable';
import Toasts from 'components/plans/toasts';
import UserInfo from 'components/jobs/userInfo';
import { LabelWithSpinner } from 'components/plans/ctaButton';

import type { AppState } from 'app/reducer';
import type { InitialProps } from 'components/utils';
import type { Job as JobType } from 'jobs/reducer';
import type { Plan as PlanType } from 'plans/reducer';
import type {
  Product as ProductType,
  Version as VersionType,
} from 'products/reducer';
import type { User as UserType } from 'user/reducer';

type Props = {
  ...InitialProps,
  user: UserType,
  product: ProductType | null,
  version: VersionType | null,
  versionLabel: ?string,
  plan: PlanType | null,
  job: ?JobType,
  jobId: ?string,
  doFetchVersion: typeof fetchVersion,
  doFetchJob: typeof fetchJob,
  doUpdateJob: typeof updateJob,
  doRequestCancelJob: typeof requestCancelJob,
};
type State = {
  modalOpen: boolean,
  canceling: boolean,
};

class JobDetail extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { modalOpen: false, canceling: false };
  }

  fetchVersionIfMissing() {
    const { product, version, versionLabel, doFetchVersion } = this.props;
    if (
      product &&
      versionLabel &&
      shouldFetchVersion({ product, version, versionLabel })
    ) {
      // Fetch version from API
      doFetchVersion({ product: product.id, label: versionLabel });
    }
  }

  fetchJobIfMissing() {
    const { job, jobId, doFetchJob } = this.props;
    if (job === undefined && jobId) {
      // Fetch job from API
      doFetchJob(jobId);
    }
  }

  componentDidMount() {
    this.fetchVersionIfMissing();
    this.fetchJobIfMissing();
  }

  componentDidUpdate(prevProps) {
    const { product, version, versionLabel, job, jobId } = this.props;
    const versionChanged =
      product !== prevProps.product ||
      version !== prevProps.version ||
      versionLabel !== prevProps.versionLabel;
    const jobChanged = job !== prevProps.job || jobId !== prevProps.jobId;
    if (versionChanged) {
      this.fetchVersionIfMissing();
    }
    if (jobChanged) {
      this.fetchJobIfMissing();
    }
  }

  toggleModal = (isOpen: boolean) => {
    this.setState({ modalOpen: isOpen });
  };

  openModal = () => {
    this.toggleModal(true);
  };

  requestCancelJob = () => {
    const { job, doRequestCancelJob } = this.props;
    /* istanbul ignore if */
    if (!job) {
      return;
    }
    doRequestCancelJob(job.id).then(() => {
      this.setState({ canceling: true });
    });
  };

  getCancelBtn(): React.Node {
    const { job } = this.props;
    /* istanbul ignore if */
    if (!job) {
      return null;
    }
    if (job.status === CONSTANTS.STATUS.STARTED && job.user_can_edit) {
      const { canceling } = this.state;
      if (canceling) {
        return (
          <Button
            label={
              <LabelWithSpinner
                label="Canceling Installation..."
                variant="base"
                size="x-small"
              />
            }
            disabled
          />
        );
      }
      return (
        <Button
          label="Cancel Installation"
          variant="base"
          className="slds-button_text-destructive"
          onClick={this.requestCancelJob}
        />
      );
    }
    return null;
  }

  render(): React.Node {
    const {
      user,
      product,
      version,
      versionLabel,
      plan,
      job,
      jobId,
      doUpdateJob,
    } = this.props;
    const loadingOrNotFound = getLoadingOrNotFound({
      product,
      version,
      versionLabel,
      plan,
      job,
      jobId,
      isLoggedIn: user !== null,
    });
    if (loadingOrNotFound !== false) {
      return loadingOrNotFound;
    }
    // this redundant check is required to satisfy Flow:
    // https://flow.org/en/docs/lang/refinements/#toc-refinement-invalidations
    /* istanbul ignore if */
    if (!product || !version || !plan || !job) {
      return <ProductNotFound />;
    }
    const linkToPlan = routes.plan_detail(
      product.slug,
      version.label,
      plan.slug,
    );
    const { canceling } = this.state;
    return (
      <DocumentTitle
        title={`Installation | ${plan.title} | ${product.title} | MetaDeploy`}
      >
        <>
          <Header
            product={product}
            version={version}
            plan={plan}
            navRight={
              <>
                {this.getCancelBtn()}
                <Button
                  label="Share Installation"
                  iconCategory="utility"
                  iconName="share"
                  iconPosition="left"
                  onClick={this.openModal}
                />
              </>
            }
          />
          <ShareModal
            isOpen={this.state.modalOpen}
            job={job}
            toggleModal={this.toggleModal}
            updateJob={doUpdateJob}
          />
          <BodyContainer>
            <Toasts job={job} label="Installation" />
            <Intro
              results={<JobResults job={job} label="Installation" />}
              cta={
                <CtaButton
                  job={job}
                  linkToPlan={linkToPlan}
                  canceling={canceling}
                />
              }
              postMessage={<JobMessage job={job} openModal={this.openModal} />}
            />
            <UserInfo job={job} />
            <ProgressBar job={job} />
            {plan.steps && plan.steps.length ? (
              <StepsTable plan={plan} job={job} />
            ) : null}
          </BodyContainer>
        </>
      </DocumentTitle>
    );
  }
}

const select = (appState: AppState, props: InitialProps) => ({
  user: selectUserState(appState),
  product: selectProduct(appState, props),
  version: selectVersion(appState, props),
  versionLabel: selectVersionLabel(appState, props),
  plan: selectPlan(appState, props),
  job: selectJob(appState, props),
  jobId: selectJobId(appState, props),
});

const actions = {
  doFetchVersion: fetchVersion,
  doFetchJob: fetchJob,
  doUpdateJob: updateJob,
  doRequestCancelJob: requestCancelJob,
};

const WrappedJobDetail: React.ComponentType<InitialProps> = connect(
  select,
  actions,
)(JobDetail);

export default WrappedJobDetail;