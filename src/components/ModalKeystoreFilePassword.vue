<template>
    <div class="modal-password">
        <Modal
            :title="$t('modalKeystoreFilePassword.title')"
            :not-closable="state.isBusy"
            :is-open="state.isOpen"
            @change="handleModalChangeIsOpen"
        >
            <template v-slot:banner>
                <Warning />
            </template>
            <form @submit.prevent="handleSubmit">
                <TextInput
                    class="input"
                    :value="state.password"
                    :error="state.error"
                    :placeholder="$t('common.password.nineCharacters')"
                    obscure
                    @input="handleInputChange"
                />
                <Button
                    class="btn"
                    :busy="state.isBusy"
                    :label="$t('modalKeystoreFilePassword.accessWallet')"
                    :disabled="disabled"
                />
            </form>
        </Modal>
    </div>
</template>

<script lang="ts">
import Modal from "../components/Modal.vue";
import Warning from "../components/Warning.vue";
import TextInput from "../components/TextInput.vue";
import Button from "../components/Button.vue";
import {
    computed,
    createComponent,
    PropType,
    watch,
    SetupContext
} from "@vue/composition-api";

export interface State {
    isOpen: boolean;
    password: string;
    error: string | null;
    isBusy: boolean;
}

interface Props {
    state: State;
}

export default createComponent({
    components: {
        Modal,
        Warning,
        TextInput,
        Button
    },
    props: {
        state: (Object as unknown) as PropType<State>
    },
    model: {
        prop: "state",
        event: "change"
    },
    setup(props: Props, context: SetupContext) {
        const disabled = computed(() => {
            return (
                props.state.password === "" || props.state.password.length < 9
            );
        });

        function handleModalChangeIsOpen(isOpen: boolean): void {
            context.emit("change", { ...props.state, isOpen });
        }

        function handleInputChange(value: string): void {
            props.state.error = null;
            context.emit("change", { ...props.state, password: value });
        }

        function handleSubmit(): void {
            context.emit("submit", props.state);
        }

        watch(
            () => props.state.isOpen,
            (newVal: boolean) => {
                if (newVal) {
                    context.emit("change", { ...props.state, password: "" });
                }
            }
        );

        return {
            disabled,
            handleModalChangeIsOpen,
            handleInputChange,
            handleSubmit
        };
    }
});
</script>

<style scoped lang="postcss">
.input {
    margin-block-end: 20px;
}

.btn {
    width: 100%;
}
</style>
