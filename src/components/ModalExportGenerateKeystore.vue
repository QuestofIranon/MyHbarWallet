<template>
    <div class="modal-export-generate-keystore">
        <Modal
            :is-open="state.isOpen"
            :title="$t('modalExportGenerateKeystore.title')"
            @change="handleModalChangeIsOpen"
        >
            <div class="password-info-header-wrapper">
                <div class="password-info-header">
                    {{ $t("modalExportGenerateKeystore.yourPassword") }}
                    <InfoButton :message="$t('common.password.thisPassword')" />
                </div>
            </div>
            <PasswordGenerator
                ref="passwordGenerator"
                v-model="state.passwordGeneratorState"
                @submit="handleSubmitPassword"
            />
            <p
                class="footer"
                v-html="
                    formatRich(
                        $t(
                            'modalCreateByKeystore.doNotForgetToSaveYourPassword'
                        ).toString(),
                        { strongClass: 'important' }
                    )
                "
            />
        </Modal>
    </div>
</template>

<script lang="ts">
import {
    createComponent,
    PropType,
    SetupContext,
    watch
} from "@vue/composition-api";
import Modal from "../components/Modal.vue";
import Warning from "../components/Warning.vue";
import InfoButton from "../components/InfoButton.vue";
import { mdiArrowRight } from "@mdi/js";
import { formatRich } from "../formatter";
import PasswordGenerator, {
    State as PasswordGeneratorState
} from "../components/PasswordGenerator.vue";
import { Vue } from "vue/types/vue";

export interface State {
    isOpen: boolean;
    isBusy: boolean;
    passwordGeneratorState: PasswordGeneratorState;
}

interface Props {
    state: State;
}

type Context = SetupContext & {
    refs: {
        passwordGenerator: Vue & {
            focusInput(): void;
        };
    };
};

export default createComponent({
    components: {
        Modal,
        Warning,
        InfoButton,
        PasswordGenerator
    },
    model: {
        prop: "state",
        event: "change"
    },
    props: {
        state: (Object as unknown) as PropType<State>
    },
    setup(props: Props, context: SetupContext) {
        watch(
            () => props.state.isOpen,
            (newVal: boolean) => {
                if (newVal) {
                    if (
                        (context as Context).refs.passwordGenerator != undefined
                    ) {
                        (context as Context).refs.passwordGenerator.focusInput();
                    }
                }
            }
        );

        function handleModalChangeIsOpen(isOpen: boolean): void {
            context.emit("change", { ...props.state, isOpen });
        }

        function handleSubmitPassword(): void {
            context.emit("submit", { ...props.state });
        }

        return {
            handleModalChangeIsOpen,
            handleSubmitPassword,
            mdiArrowRight,
            formatRich
        };
    }
});
</script>

<style lang="postcss" scoped>
.password-info-header-wrapper {
    color: var(--color-washed-black);
    display: flex;
    justify-content: space-around;
}

.password-info-header {
    display: inline;
    font-size: 20px;
    font-weight: 500;
    padding-block-end: 40px;
}

.footer {
    color: var(--color-china-blue);
    font-size: 14px;
    margin: 0;
    padding: 0;
    text-align: center;

    & >>> .important {
        color: var(--color-lightish-red);
        font-weight: 500;
    }
}
</style>
