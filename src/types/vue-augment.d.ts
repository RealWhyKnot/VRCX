export {};

declare module "vue" {
  type ComponentCustomProps = {
    onClick?: (event: MouseEvent) => void;
  };
}
