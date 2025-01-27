<template>
    <div class="access-my-account">
        <div class="wrap">
            <PageTitle :title="$t('common.accessMyAccount')">
                {{ $t("accessMyAccount.dontHaveAnAccount") }}
                <router-link :to="{ name: 'create-account' }">
                    {{ $t("accessMyAccount.createANewAccount") }}
                </router-link>
            </PageTitle>
            <AccountTileButtons @click="handleClickTiles" />
        </div>

        <FAQs />

        <ModalAccessByPrivateKey
            v-model="state.modalAccessByPrivateKeyState"
            @submit="handleAccessByPrivateKeySubmit"
        />

        <ModalAccessByPhrase
            v-model="state.modalAccessByPhraseState"
            @submit="handleAccessByPhraseSubmit"
        />

        <ModalAccessByHardware
            v-model="state.modalAccessByHardwareState.isOpen"
            @submit="handleAccessByHardwareSubmit"
        />

        <ModalAccessBySoftware
            v-model="state.modalAccessBySoftwareState.isOpen"
            @submit="handleAccessBySoftwareSubmit"
        />

        <ModalKeystoreFilePassword
            v-model="state.modalKeystoreFilePasswordState"
            @submit="handleAccessByKeystoreSubmit"
        />

        <ModalEnterAccountId
            v-model="state.modalEnterAccountIdState"
            :private-key="state.privateKey"
            @noAccount="handleDoesntHaveAccount"
            @submit="handleAccountIdSubmit"
        />

        <ModalRequestToCreateAccount
            v-model="state.modalRequestToCreateAccountState.isOpen"
            :public-key="state.publicKey"
            @hasAccount="handleHasAccount"
        />

        <input
            v-show="false"
            id="file-upload"
            ref="file"
            type="file"
            @change="loadTextFromFile"
        />
    </div>
</template>

<script lang="ts">
import FAQs from "../components/FAQs.vue";
import AccountTileButtons from "../components/AccountTileButtons.vue";
import ModalAccessByHardware, {
    AccessHardwareOption
} from "../components/ModalAccessByHardware.vue";
import ModalAccessBySoftware, {
    AccessSoftwareOption
} from "../components/ModalAccessBySoftware.vue";
import ModalAccessByPhrase from "../components/ModalAccessByPhrase.vue";
import ModalAccessByPrivateKey from "../components/ModalAccessByPrivateKey.vue";
import PageTitle from "../components/PageTitle.vue";
import ModalKeystoreFilePassword from "../components/ModalKeystoreFilePassword.vue";
import ModalEnterAccountId from "../components/ModalEnterAccountId.vue";
import ModalRequestToCreateAccount from "../components/ModalRequestToCreateAccount.vue";
import { AccessAccountDTO, Id } from "../store/modules/wallet";
import {
    createComponent,
    reactive,
    ref,
    SetupContext
} from "@vue/composition-api";
import LedgerNanoS from "../wallets/hardware/LedgerNanoS";
import Vue from "vue";
import store from "../store";
import {
    ALERT,
    HANDLE_HEDERA_ERROR,
    HANDLE_LEDGER_ERROR,
    LOG_IN
} from "../store/actions";
import SoftwareWallet from "../wallets/software/SoftwareWallet";
import settings from "../settings";
import { HederaErrorTuple, LedgerErrorTuple } from "src/store/modules/errors";

export default createComponent({
    components: {
        FAQs,
        AccountTileButtons,
        ModalAccessByHardware,
        ModalAccessBySoftware,
        ModalAccessByPhrase,
        ModalAccessByPrivateKey,
        PageTitle,
        ModalKeystoreFilePassword,
        ModalEnterAccountId,
        ModalRequestToCreateAccount
    },
    setup(props: object, context: SetupContext) {
        const state: AccessAccountDTO = reactive({
            wallet: null,
            privateKey: null,
            publicKey: null,
            keyFile: null,
            modalAccessByHardwareState: {
                isOpen: false
            },
            modalAccessBySoftwareState: {
                isOpen: false
            },
            modalAccessByPhraseState: {
                isOpen: false,
                isBusy: false,
                words: [],
                isValid: true
            },
            modalKeystoreFilePasswordState: {
                isOpen: false,
                password: "",
                error: null,
                isBusy: false
            },
            modalAccessByPrivateKeyState: {
                isOpen: false,
                rawPrivateKey: "",
                isBusy: false
            },
            modalEnterAccountIdState: {
                failed: null,
                errorMessage: null,
                isOpen: false,
                isBusy: false,
                account: null,
                valid: false
            },
            modalRequestToCreateAccountState: {
                isOpen: false
            }
        });

        const file = ref<HTMLInputElement | null>(null);

        function setPrivateKey(
            newPrivateKey: import("@hashgraph/sdk").Ed25519PrivateKey
        ): void {
            state.privateKey = newPrivateKey;
            state.publicKey = newPrivateKey.publicKey;
        }

        async function loadTextFromFile(event: Event): Promise<void> {
            const target = event.target as HTMLInputElement;

            if (target.files == null) {
                // User hit cancel
                return;
            }

            const file = target.files[0];

            const keyStoreArrayBuff = await new Promise<ArrayBuffer>(
                (resolve, reject) => {
                    const reader = new FileReader();

                    reader.addEventListener("error", reject);
                    reader.addEventListener("loadend", (): void => {
                        resolve(reader.result as ArrayBuffer);
                    });

                    reader.readAsArrayBuffer(file);
                }
            );

            target.value = ""; // change back to initial state to guarantee that click fires next time
            state.modalKeystoreFilePasswordState.isOpen = true;
            state.keyFile = new Uint8Array(keyStoreArrayBuff);
        }

        function openInterface(): void {
            context.root.$router.push({ name: "interface" });
        }

        async function constructOperator(
            account: Id
        ): Promise<import("@hashgraph/sdk").Operator> {
            if (state.wallet !== null) {
                if (state.wallet.hasPrivateKey()) {
                    return {
                        account,
                        privateKey: await state.wallet!.getPrivateKey()
                    } as import("@hashgraph/sdk").Operator;
                } else {
                    return {
                        account,
                        publicKey: (await state.wallet!.getPublicKey()) as import("@hashgraph/sdk").Ed25519PublicKey,
                        signer: state.wallet!.signTransaction.bind(
                            state.wallet!
                        ) as import("@hashgraph/sdk").Signer
                    };
                }
            }

            return {
                account: null as Id | null,
                privateKey: null as
                    | import("@hashgraph/sdk").Ed25519PrivateKey
                    | null
            } as import("@hashgraph/sdk").Operator;
        }

        async function constructClient(
            account: Id
        ): Promise<import("@hashgraph/sdk").Client | undefined> {
            let client: import("@hashgraph/sdk").Client | undefined = undefined;

            const {
                Client,
                CryptoTransferTransaction,
                HederaError,
                ResponseCodeEnum
            } = await (import("@hashgraph/sdk") as Promise<
                typeof import("@hashgraph/sdk")
            >);

            try {
                const operator: import("@hashgraph/sdk").Operator = await constructOperator(
                    account
                );
                client = new Client({
                    nodes: {
                        [settings.network.proxy]: {
                            shard: 0,
                            realm: 0,
                            account: 3
                        }
                    },
                    operator
                });

                await new CryptoTransferTransaction(client)
                    .addSender(account, 0)
                    .addRecipient({ realm: 0, shard: 0, account: 3 }, 0)
                    .setTransactionFee(1)
                    .build()
                    .executeForReceipt();
            } catch (error) {
                if (error instanceof HederaError) {
                    // Transaction was valid except for deliberately insufficient fee,
                    // meaning that the account matches the key and that nothing went wrong
                    if (error.code === ResponseCodeEnum.INSUFFICIENT_TX_FEE) {
                        return client;
                    }
                }

                // Else, throw the error, failed to make a client (failed to login)
                throw error;
            }
        }

        async function login(account: Id): Promise<void> {
            const client:
                | import("@hashgraph/sdk").Client
                | undefined = await constructClient(account);

            if (state.wallet !== null && client !== undefined) {
                await store.dispatch(LOG_IN, {
                    account,
                    wallet: state.wallet,
                    client
                });
            }
        }

        function handleClickTiles(which: string): void {
            if (which === "hardware") {
                state.modalAccessByHardwareState.isOpen = true;
            } else if (which === "software") {
                state.modalAccessBySoftwareState.isOpen = true;
            }
        }

        function handleAccessBySoftwareSubmit(
            which: AccessSoftwareOption
        ): void {
            state.modalAccessBySoftwareState.isOpen = false;

            if (which === "file") {
                if (file.value != null) {
                    file.value.click(); // triggers loadTextFromFile via hidden input @click
                }
            } else {
                setTimeout(() => {
                    if (which === AccessSoftwareOption.Phrase) {
                        state.modalAccessByPhraseState.isOpen = true;
                    } else if (which === AccessSoftwareOption.Key) {
                        state.modalAccessByPrivateKeyState.isOpen = true;
                    }
                }, 125);
            }
        }

        async function handleAccessByHardwareSubmit(
            which: AccessHardwareOption
        ): Promise<void> {
            switch (which) {
                case AccessHardwareOption.Ledger:
                    try {
                        state.wallet = new LedgerNanoS();
                        state.publicKey = (await state.wallet.getPublicKey()) as import("@hashgraph/sdk").Ed25519PublicKey;
                        state.modalAccessByHardwareState.isOpen = false;
                        Vue.nextTick(
                            () => (state.modalEnterAccountIdState.isOpen = true)
                        );
                    } catch (error) {
                        if (error.name === "TransportStatusError") {
                            store.dispatch(HANDLE_LEDGER_ERROR, {
                                error,
                                showAlert: true
                            });
                        } else {
                            throw error;
                        }
                    }
                    break;
                default:
                    state.wallet = null;
                    break;
            }
        }

        async function handleAccessByKeystoreSubmit(): Promise<void> {
            const pwState = state.modalKeystoreFilePasswordState;
            pwState.isBusy = true;

            try {
                const { Ed25519PrivateKey } = await (import(
                    "@hashgraph/sdk"
                ) as Promise<typeof import("@hashgraph/sdk")>);

                setPrivateKey(
                    await Ed25519PrivateKey.fromKeystore(
                        state.keyFile as Uint8Array,
                        state.modalKeystoreFilePasswordState.password
                    )
                );

                // Close  previous modal and open another one
                pwState.isBusy = false;
                pwState.isOpen = false;
                Vue.nextTick(
                    () => (state.modalEnterAccountIdState.isOpen = true)
                );
            } catch (error) {
                console.warn(error);
                pwState.isBusy = false;
                pwState.error = "Invalid password";
            }
        }

        async function handleAccessByPhraseSubmit(): Promise<void> {
            const accessByPhraseState = state.modalAccessByPhraseState;

            accessByPhraseState.isBusy = true;

            try {
                const { Ed25519PrivateKey } = await (import(
                    "@hashgraph/sdk"
                ) as Promise<typeof import("@hashgraph/sdk")>);

                setPrivateKey(
                    // `.derive(0)` to use the same key as the default account of the mobile wallet
                    (await Ed25519PrivateKey.fromMnemonic(
                        accessByPhraseState.words
                    )).derive(0)
                );

                // Close  previous modal and open another one
                accessByPhraseState.isBusy = false;
                accessByPhraseState.isOpen = false;
                Vue.nextTick(
                    () => (state.modalEnterAccountIdState.isOpen = true)
                );
                accessByPhraseState.isValid = true;
            } catch (error) {
                accessByPhraseState.isBusy = false;

                store.dispatch(ALERT, {
                    level: "error",
                    message: "Invalid Mnemonic"
                });

                accessByPhraseState.isValid = false;
            }
        }

        async function handleAccessByPrivateKeySubmit(): Promise<void> {
            state.modalAccessByPrivateKeyState.isBusy = true;
            const { Ed25519PrivateKey } = await (import(
                "@hashgraph/sdk"
            ) as Promise<typeof import("@hashgraph/sdk")>);

            setPrivateKey(
                Ed25519PrivateKey.fromString(
                    state.modalAccessByPrivateKeyState.rawPrivateKey
                )
            );

            // Close previous modal and open another one
            state.modalAccessByPrivateKeyState.isOpen = false;

            setTimeout(() => {
                state.modalAccessByPrivateKeyState.isBusy = false;
                state.modalEnterAccountIdState.isOpen = true;
            }, 125);
        }

        async function handleAccountIdSubmit(account: Id): Promise<void> {
            state.modalEnterAccountIdState.isBusy = true;

            if (state.wallet === null) {
                if (state.privateKey !== null) {
                    state.wallet = new SoftwareWallet(
                        state.privateKey as import("@hashgraph/sdk").Ed25519PrivateKey,
                        state.publicKey as import("@hashgraph/sdk").Ed25519PublicKey
                    );
                }
            }

            try {
                await login(account);
                Vue.nextTick(
                    () => (state.modalEnterAccountIdState.isOpen = false)
                );
                openInterface();
            } catch (error) {
                const result: HederaErrorTuple = await store.dispatch(
                    HANDLE_HEDERA_ERROR,
                    { error, showAlert: false }
                );

                state.modalEnterAccountIdState.errorMessage = result.message;

                if (result.message === "") {
                    const result: LedgerErrorTuple = await store.dispatch(
                        HANDLE_LEDGER_ERROR,
                        { error, showAlert: false }
                    );

                    if (result.message === "") {
                        throw error;
                    }

                    state.modalEnterAccountIdState.errorMessage =
                        result.message;
                }
            } finally {
                state.modalEnterAccountIdState.isBusy = false;
            }
        }

        function handleDoesntHaveAccount(): void {
            state.modalEnterAccountIdState.isOpen = false;
            Vue.nextTick(
                () => (state.modalRequestToCreateAccountState.isOpen = true)
            );
        }

        function handleHasAccount(): void {
            state.modalRequestToCreateAccountState.isOpen = false;
            Vue.nextTick(() => (state.modalEnterAccountIdState.isOpen = true));
        }

        return {
            state,
            file,
            handleClickTiles,
            handleAccessBySoftwareSubmit,
            loadTextFromFile,
            handleAccessByKeystoreSubmit,
            handleAccessByPhraseSubmit,
            handleAccessByPrivateKeySubmit,
            handleAccountIdSubmit,
            handleAccessByHardwareSubmit,
            handleDoesntHaveAccount,
            handleHasAccount
        };
    }
});
</script>

<style lang="postcss" scoped>
a {
    color: var(--color-melbourne-cup);
    cursor: pointer;
    text-decoration: none;
}

.access-my-account {
    display: flex;
    flex-direction: column;
}

.wrap {
    align-items: center;
    display: flex;
    flex-direction: column;
    padding: 80px 0;

    @media (max-width: 600px) {
        padding: 20px 0;
    }
}
</style>
