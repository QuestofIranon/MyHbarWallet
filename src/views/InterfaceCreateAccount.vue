<template>
    <InterfaceForm :title="$t('common.createAccount')">
        <Notice :symbol="mdiHelpCircleOutline">
            {{ $t("interfaceCreateAccount.toCreateAccount") }}
        </Notice>

        <TextInput
            v-model="state.newBalance"
            :error="state.newBalanceError"
            :min="1"
            :suffix="Unit.Hbar"
            :valid="validBalance"
            has-input
            :label="$t('interfaceCreateAccount.initialBalance')"
            show-validation
        />

        <TextInput
            v-model="state.publicKey"
            :error="state.keyError"
            :valid="state.isPublicKeyValid"
            :spellcheck-disabled="true"
            :autocomplete-disabled="true"
            :label="$t('interfaceCreateAccount.publicKey')"
            show-validation
        />

        <template v-slot:footer>
            <Button
                :busy="state.isBusy"
                :disabled="!state.isPublicKeyValid || !validBalance"
                :label="$t('common.createAccount')"
                @click="handleShowSummary"
            />
        </template>

        <ModalCreateAccountSuccess
            :account-id="state.account"
            :is-open="state.successModalIsOpen"
            @change="handleSuccessModalChange"
        />

        <ModalFeeSummary
            v-model="state.summaryModalIsOpen"
            :amount="summaryAmount"
            :items="summaryItems"
            account=""
            tx-type="createAccount"
            @submit="handleCreateAccount"
        />
    </InterfaceForm>
</template>

<script lang="ts">
import TextInput from "../components/TextInput.vue";
import Button from "../components/Button.vue";
import InterfaceForm from "../components/InterfaceForm.vue";
import {
    computed,
    createComponent,
    reactive,
    SetupContext,
    watch
} from "@vue/composition-api";
import store from "../store";
import ModalCreateAccountSuccess from "../components/ModalCreateAccountSuccess.vue";
import ModalFeeSummary, { Item } from "../components/ModalFeeSummary.vue";
import { getValueOfUnit, Unit } from "../units";
import { BigNumber } from "bignumber.js";
import { mdiHelpCircleOutline } from "@mdi/js";
import Notice from "../components/Notice.vue";
import { formatHbar } from "../formatter";
import {
    ESTIMATED_FEE_HBAR,
    ESTIMATED_FEE_TINYBAR,
    MAX_FEE_TINYBAR
} from "../store/getters";
import {
    ALERT,
    HANDLE_HEDERA_ERROR,
    HANDLE_LEDGER_ERROR,
    REFRESH_BALANCE_AND_RATE
} from "../store/actions";

const estimatedFeeHbar = store.getters[ESTIMATED_FEE_HBAR];
const estimatedFeeTinybar = store.getters[ESTIMATED_FEE_TINYBAR];

interface State {
    newBalance: string;
    publicKey: string;
    isBusy: boolean;
    successModalIsOpen: boolean;
    summaryModalIsOpen: boolean;
    keyError: string;
    newBalanceError: string;
    account: string;
    isPublicKeyValid: boolean;
}

async function isPublicKeyValid(key: string): Promise<boolean> {
    try {
        const { Ed25519PublicKey } = await (import("@hashgraph/sdk") as Promise<
            typeof import("@hashgraph/sdk")
        >);

        Ed25519PublicKey.fromString(key);
        return true;
    } catch (error) {
        if (error instanceof Error) {
            // The exception message changes depending on the input
            if (error.message === "invalid public key: " + key) {
                return false;
            }
        }

        throw error;
    }
}

export default createComponent({
    components: {
        TextInput,
        InterfaceForm,
        Button,
        ModalCreateAccountSuccess,
        Notice,
        ModalFeeSummary
    },
    setup(_: object | null, context: SetupContext) {
        const state = reactive<State>({
            newBalance: "",
            publicKey: "",
            isBusy: false,
            successModalIsOpen: false,
            summaryModalIsOpen: false,
            keyError: "",
            newBalanceError: "",
            account: "",
            isPublicKeyValid: false
        });

        const validBalance = computed(() => {
            // All we should check is that this is, in fact, a number
            return !isNaN(parseInt(state.newBalance, 10));
        });

        watch(async () => {
            state.isPublicKeyValid = await isPublicKeyValid(state.publicKey);
        });

        // Just for display in modal title
        const summaryAmount = computed(() => {
            return formatHbar(new BigNumber(state.newBalance));
        });

        const summaryItems = computed(() => {
            return [
                {
                    description: "Initial Balance",
                    value: validBalance.value
                        ? new BigNumber(state.newBalance)
                        : new BigNumber(0)
                },
                { description: "Estimated Fee", value: estimatedFeeHbar }
            ] as Item[];
        });

        async function handleCreateAccount(): Promise<void> {
            state.isBusy = true;

            if (store.state.wallet.session == null) {
                throw new Error(
                    context.root
                        .$t("common.error.nullAccountOnInterface")
                        .toString()
                );
            }

            const client = store.state.wallet.session.client;

            const { HederaError, ResponseCodeEnum } = await (import(
                "@hashgraph/sdk"
            ) as Promise<typeof import("@hashgraph/sdk")>);

            try {
                // The new wallet's initial balance
                const newBalanceTinybar = new BigNumber(
                    state.newBalance
                ).multipliedBy(getValueOfUnit(Unit.Hbar));

                // The current user's balance
                const balanceTinybar =
                    store.state.wallet.balance == null
                        ? new BigNumber(0)
                        : store.state.wallet.balance;

                const {
                    AccountCreateTransaction,
                    Client,
                    Ed25519PublicKey
                } = await (import("@hashgraph/sdk") as Promise<
                    typeof import("@hashgraph/sdk")
                >);

                const key = Ed25519PublicKey.fromString(state.publicKey);
                const maxTxFeeTinybar = store.getters[MAX_FEE_TINYBAR](
                    balanceTinybar.minus(
                        newBalanceTinybar.plus(estimatedFeeTinybar)
                    )
                );

                const accountIdIntermediate = (await new AccountCreateTransaction(
                    client as InstanceType<typeof Client>
                )
                    .setInitialBalance(newBalanceTinybar)
                    .setTransactionFee(maxTxFeeTinybar)
                    .setKey(key)
                    .build()
                    .executeForReceipt()).getAccountid();

                // Handle undefined
                if (accountIdIntermediate == null) {
                    throw new Error(
                        context.root
                            .$t("common.error.invalidAccount")
                            .toString()
                    );
                }

                // state.accountIdIntermediate must be AccountID
                // get shard, realm, state.account separately and construct a new object
                state.account =
                    accountIdIntermediate.getShardnum() +
                    "." +
                    accountIdIntermediate.getRealmnum() +
                    "." +
                    accountIdIntermediate.getAccountnum();

                // If creating state.account succeeds then remove all the error
                state.newBalanceError = "";

                // Refresh Balance
                store.dispatch(REFRESH_BALANCE_AND_RATE);

                state.successModalIsOpen = true;
            } catch (error) {
                if (error instanceof HederaError) {
                    const errorMessage = await store.dispatch(
                        HANDLE_HEDERA_ERROR,
                        { error, showAlert: false }
                    );

                    // Small duplication of effort to assign errorMessage to correct TextInput
                    switch (error.code) {
                        case ResponseCodeEnum.INSUFFICIENT_ACCOUNT_BALANCE:
                        case ResponseCodeEnum.INSUFFICIENT_PAYER_BALANCE:
                            state.newBalanceError = errorMessage;
                            break;
                        default:
                            if (errorMessage !== "") {
                                store.dispatch(ALERT, {
                                    message: errorMessage,
                                    level: "warn"
                                });
                            } else {
                                throw error; // Unhandled Error Modal will open
                            }
                    }
                } else if (error.name === "TransportStatusError") {
                    store.dispatch(HANDLE_LEDGER_ERROR, {
                        error,
                        showAlert: true
                    });
                } else {
                    throw error;
                }
            } finally {
                state.isBusy = false;
            }
        }

        function handleSuccessModalChange(isOpen: boolean): void {
            if (!isOpen) {
                state.successModalIsOpen = isOpen;
                state.isBusy = false;
                state.publicKey = "";
                state.newBalance = "";
            }
        }

        function handleShowSummary(): void {
            state.summaryModalIsOpen = true;
        }

        return {
            state,
            summaryAmount,
            summaryItems,
            validBalance,
            handleCreateAccount,
            handleShowSummary,
            handleSuccessModalChange,
            Unit,
            mdiHelpCircleOutline
        };
    }
});
</script>
