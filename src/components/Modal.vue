<template>
    <div
        v-if="isOpen"
        class="modal-background"
        role="dialog"
        aria-modal="true"
        @mousedown.self="handleClose"
    >
        <div class="modal" :class="{ large: props.large }">
            <header v-if="!props.hideDecoration">
                <span class="title">{{ props.title }}</span>
                <MaterialDesignIcon
                    v-if="!props.notClosable"
                    class="close"
                    :icon="mdiClose"
                    @click="handleClose"
                />
            </header>
            <div class="main">
                <slot name="banner"></slot>
                <div class="content-container">
                    <slot></slot>
                </div>
            </div>
        </div>
    </div>
</template>

<script lang="ts">
import {
    createComponent,
    watch,
    onUnmounted,
    SetupContext,
    onMounted
} from "@vue/composition-api";
import { mdiClose } from "@mdi/js";
import MaterialDesignIcon from "../components/MaterialDesignIcon.vue";

const modalIds: number[] = [];
let nextModalId = 0;

function modalIsTop(id: number): boolean {
    return modalIds[modalIds.length - 1] === id;
}

// The isOpen property controls if the modal is open or not. It should be bound with
// the v-model directive to allow the modal to close itself (click out and close button).
export default createComponent({
    props: {
        notClosable: Boolean,
        isOpen: Boolean,
        title: String,
        hideDecoration: Boolean,
        large: Boolean
    },
    components: {
        MaterialDesignIcon
    },
    model: {
        prop: "isOpen",
        event: "change"
    },
    setup(
        props: {
            notClosable: boolean;
            isOpen: boolean;
            title: string;
            hideDecoration: boolean;
            large: boolean;
        },
        context: SetupContext
    ) {
        const id = nextModalId++;

        function handleClose(): void {
            if (!props.notClosable && modalIsTop(id)) {
                context.emit("change", false);
            }
        }

        function handleWindowKeyDown(event: KeyboardEvent): void {
            // ESCAPE (27)
            if (!props.notClosable && props.isOpen && event.keyCode == 27) {
                handleClose();
            }
        }

        function unregister(): void {
            modalIds.splice(modalIds.indexOf(id), 1);
        }

        window.addEventListener("keydown", handleWindowKeyDown);

        onMounted(() => {
            // Do nothing if the modal is not open
            if (!props.isOpen) {
                return;
            }

            const elModals = context.root.$el.querySelectorAll(".modal");
            elModals.forEach(element => {
                element.addEventListener(
                    "touchstart",
                    () => {
                        if (element.scrollTop <= 0) {
                            element.scrollTo(0, 1);
                            return;
                        }
                        if (
                            element.scrollTop + element.clientHeight >=
                            element.scrollHeight
                        ) {
                            element.scrollTo(
                                0,
                                element.scrollHeight - element.clientHeight - 1
                            );
                        }
                    },
                    { passive: true }
                );
            });
        });

        onUnmounted(() => {
            unregister();
            window.removeEventListener("keydown", handleWindowKeyDown);
            const elModals = context.root.$el.querySelectorAll(".modal");
            elModals.forEach(element => {
                element.removeEventListener("touchstart", () => {
                    if (element.scrollTop <= 0) {
                        element.scrollTo(0, 1);
                        return;
                    }
                    if (
                        element.scrollTop + element.clientHeight >=
                        element.scrollHeight
                    ) {
                        element.scrollTo(
                            0,
                            element.scrollHeight - element.clientHeight - 1
                        );
                    }
                });
            });
        });

        watch(
            () => props.isOpen,
            (isOpen: boolean, prevIsOpen: boolean) => {
                const hasOpened = isOpen && !prevIsOpen;
                const hasClosed = !isOpen && prevIsOpen;

                if (hasOpened) {
                    modalIds.push(id);
                } else if (hasClosed) {
                    unregister();
                }
            }
        );

        return {
            mdiClose,
            handleClose,
            handleWindowKeyDown,
            props
        };
    }
});
</script>

<style scoped lang="postcss">
.modal-background {
    align-items: center;
    background-color: rgba(0, 0, 0, 0.4);
    display: flex;
    inset: 0;
    opacity: 1;
    overflow: hidden;
    overflow-x: hidden;
    overflow-y: auto;
    padding: 25px 0;
    pointer-events: all;
    position: fixed;
    transition: opacity 0.15s linear;
    z-index: 2;

    @media (max-width: 600px) {
        padding: 0;
    }

    @supports (-webkit-overflow-scrolling: touch) {
        background-color: var(--color-white);
    }

    @media screen and (prefers-reduced-motion: reduce) {
        transition: none;
    }
}

.modal {
    background-clip: padding-box;
    border: 0;
    border-radius: 4px;
    box-shadow: 0 0 20px rgba(0, 0, 0, 0.22);
    display: flex;
    flex-direction: column;
    margin: auto;
    max-width: 530px;
    overflow: hidden;
    overflow-y: auto;
    transform: translateY(-50px);
    transition: transform 0.3s ease-out;
    width: 100%;
    z-index: 3;

    @media screen and (prefers-reduced-motion: reduce) {
        transition: none;
    }

    @media print {
        box-shadow: none;
    }

    @media (max-width: 600px) {
        background-color: var(--color-white);
        border-radius: 0;
        height: 100vh;
        max-width: 600px;
        width: 100vw;
    }

    @supports (-webkit-overflow-scrolling: touch) {
        -webkit-overflow-scrolling: auto;
        padding-block-end: 75px;
    }
}

.modal.large {
    max-width: 800px;
}

.modal-background .modal {
    transform: none;
}

header {
    align-items: center;
    background-color: var(--color-admiralty);
    color: var(--color-white);
    display: flex;
    font-size: 20px;
    justify-content: space-between;
    padding: 14px;

    @media print {
        display: none;
    }
}

.title {
    padding-inline-start: 15px;
}

.main {
    background-color: var(--color-white);

    @media (max-width: 600px) {
        height: 100vh;
    }
}

.close {
    cursor: pointer;
}

.content-container {
    padding: 40px;

    @media (max-width: 415px) {
        padding: 20px;
    }

    @media print {
        padding: 0;
    }
}

.modal.large .content-container {
    padding: 30px;

    @media print {
        padding: 0;
    }
}
</style>
